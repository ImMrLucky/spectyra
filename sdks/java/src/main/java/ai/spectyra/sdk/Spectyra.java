package ai.spectyra.sdk;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Java entrypoint — <b>runtime</b> (HTTP to local-runtime) or <b>embedded</b> (JNA + {@code spectyra_ffi}).
 *
 * <p>Build the shared library per {@code docs/sdk/RUST_AND_FFI_BUILD.md}; set {@code SPECTYRA_FFI_PATH} for
 * embedded mode.
 */
public final class Spectyra {
  private final SpectyraConfig config;
  private final HttpClient http = HttpClient.newHttpClient();
  private final Gson gson = new Gson();
  private final SpectyraNative nativeLib;

  public Spectyra(SpectyraConfig config) {
    this.config = config != null ? config : SpectyraConfig.runtimeDefaults();
    if (this.config.getMode() == SpectyraConfig.Mode.EMBEDDED) {
      String fp = this.config.getFfiPath();
      if (fp == null || fp.isBlank()) {
        throw new IllegalStateException("embedded mode requires ffiPath or SPECTYRA_FFI_PATH");
      }
      this.nativeLib = SpectyraNative.load(fp);
    } else {
      this.nativeLib = null;
    }
  }

  public static Spectyra create(SpectyraConfig config) {
    return new Spectyra(config);
  }

  /** POST /v1/chat/run — provider keys must be configured on the local runtime. */
  public String runChatRuntimeRaw(String provider, String model, List<Map<String, String>> messages)
      throws IOException, InterruptedException {
    return runChatRuntimeRaw(provider, model, messages, null, null);
  }

  public String runChatRuntimeRaw(
      String provider,
      String model,
      List<Map<String, String>> messages,
      String requestId,
      Map<String, Object> metadata)
      throws IOException, InterruptedException {
    if (config.getMode() != SpectyraConfig.Mode.RUNTIME) {
      throw new IllegalStateException("runChatRuntimeRaw requires RUNTIME mode");
    }
    String base = config.getRuntimeBaseUrl();
    if (base == null || base.isBlank()) {
      throw new IllegalStateException("runtime base URL missing");
    }
    String url = base + "/v1/chat/run";
    JsonObject body = new JsonObject();
    body.addProperty("provider", provider);
    body.addProperty("model", model);
    body.add("messages", gson.toJsonTree(messages));
    if (requestId != null && !requestId.isBlank()) {
      body.addProperty("requestId", requestId);
    }
    if (metadata != null && !metadata.isEmpty()) {
      body.add("metadata", gson.toJsonTree(metadata));
    }
    HttpRequest req =
        HttpRequest.newBuilder(URI.create(url))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body), StandardCharsets.UTF_8))
            .build();
    HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    if (res.statusCode() / 100 != 2) {
      throw new IOException("HTTP " + res.statusCode() + ": " + res.body());
    }
    return res.body();
  }

  /** Parsed runtime response (camelCase JSON from local-runtime). */
  public SpectyraRunResult runChatRuntime(
      String provider,
      String model,
      List<Map<String, String>> messages,
      String requestId,
      Map<String, Object> metadata)
      throws IOException, InterruptedException {
    String raw = runChatRuntimeRaw(provider, model, messages, requestId, metadata);
    JsonObject env = JsonParser.parseString(raw).getAsJsonObject();
    return envelopeToResult(env);
  }

  public SpectyraRunResult runChatRuntime(String provider, String model, List<Map<String, String>> messages)
      throws IOException, InterruptedException {
    return runChatRuntime(provider, model, messages, null, null);
  }

  /**
   * {@code runtime}: delegates to {@link #runChatRuntime}. {@code embedded}: pipeline JSON then {@link
   * ProviderCaller}.
   */
  public SpectyraRunResult runChat(
      String provider,
      String model,
      List<Map<String, String>> messages,
      Map<String, Object> entitlement,
      boolean sessionFrozen,
      String requestId,
      Map<String, Object> metadata,
      ProviderCaller callProvider)
      throws Exception {
    if (config.getMode() == SpectyraConfig.Mode.RUNTIME) {
      return runChatRuntime(provider, model, messages, requestId, metadata);
    }
    if (nativeLib == null || entitlement == null || callProvider == null) {
      throw new IllegalStateException("embedded mode requires nativeLib, entitlement, and callProvider");
    }
    JsonObject innerReq = new JsonObject();
    innerReq.addProperty("provider", provider);
    innerReq.addProperty("model", model);
    innerReq.add("messages", gson.toJsonTree(messages));
    if (requestId != null && !requestId.isBlank()) {
      innerReq.addProperty("requestId", requestId);
    }
    if (metadata != null && !metadata.isEmpty()) {
      innerReq.add("metadata", gson.toJsonTree(metadata));
    }
    JsonObject pipeBody = new JsonObject();
    pipeBody.add("request", innerReq);
    pipeBody.add("entitlement", gson.toJsonTree(entitlement).getAsJsonObject());
    pipeBody.addProperty("sessionFrozen", sessionFrozen);
    String raw = nativeLib.runChatPipelineJson(gson.toJson(pipeBody));
    JsonObject pipe = JsonParser.parseString(raw).getAsJsonObject();
    if (!pipe.has("ok") || !pipe.get("ok").getAsBoolean()) {
      throw new IOException(pipe.has("error") ? pipe.get("error").getAsString() : "pipeline error");
    }
    JsonObject outObj = pipe.getAsJsonObject("output");
    JsonArray msgs = outObj.getAsJsonObject("request").getAsJsonArray("messages");
    List<Map<String, String>> optimized = new ArrayList<>();
    for (JsonElement e : msgs) {
      JsonObject o = e.getAsJsonObject();
      optimized.add(
          Map.of(
              "role", o.get("role").getAsString(),
              "content", o.get("content").getAsString()));
    }
    String providerOut = callProvider.call(optimized);
    JsonElement outParsed = JsonParser.parseString(providerOut);
    boolean optActive =
        outObj.has("optimizationApplied") && outObj.get("optimizationApplied").getAsBoolean();
    List<String> warnings = warningsFrom(outObj);
    return new SpectyraRunResult(
        outParsed,
        provider,
        model,
        0.0,
        0.0,
        0.0,
        0.0,
        optActive,
        warnings,
        null,
        pipe);
  }

  private static SpectyraRunResult envelopeToResult(JsonObject env) {
    JsonElement output = env.get("output");
    String prov = env.has("provider") ? env.get("provider").getAsString() : "";
    String mod = env.has("model") ? env.get("model").getAsString() : "";
    double savingsAmount = env.has("savingsAmount") ? env.get("savingsAmount").getAsDouble() : 0.0;
    double savingsPercent = env.has("savingsPercent") ? env.get("savingsPercent").getAsDouble() : 0.0;
    double costBefore = env.has("costBefore") ? env.get("costBefore").getAsDouble() : 0.0;
    double costAfter = env.has("costAfter") ? env.get("costAfter").getAsDouble() : 0.0;
    boolean opt =
        env.has("optimizationActive") && env.get("optimizationActive").getAsBoolean();
    JsonObject quota = env.has("quotaStatus") && env.get("quotaStatus").isJsonObject()
        ? env.getAsJsonObject("quotaStatus")
        : null;
    return new SpectyraRunResult(
        output,
        prov,
        mod,
        savingsAmount,
        savingsPercent,
        costBefore,
        costAfter,
        opt,
        warningsFrom(env),
        quota,
        env);
  }

  private static List<String> warningsFrom(JsonObject env) {
    List<String> w = new ArrayList<>();
    if (env.has("warnings") && env.get("warnings").isJsonArray()) {
      for (JsonElement e : env.getAsJsonArray("warnings")) {
        w.add(e.getAsString());
      }
    }
    return w;
  }
}
