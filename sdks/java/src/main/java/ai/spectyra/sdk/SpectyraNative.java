package ai.spectyra.sdk;

import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;

/**
 * Optional JNA binding to {@code spectyra_ffi} (same ABI as Python {@code ctypes} scaffold).
 *
 * <p>Set {@code SPECTYRA_FFI_PATH} to the absolute path of {@code libspectyra_ffi.so} /
 * {@code libspectyra_ffi.dylib} / {@code spectyra_ffi.dll}, or pass an explicit path to
 * {@link #load(String)}.
 */
public final class SpectyraNative {

  private interface SpectyraLib extends Library {
    Pointer spectyra_run_chat_pipeline_json(byte[] input);

    void spectyra_free_string(Pointer p);
  }

  private final SpectyraLib lib;

  private SpectyraNative(SpectyraLib lib) {
    this.lib = lib;
  }

  /** Load native library from {@code SPECTYRA_FFI_PATH} or explicit path. */
  public static SpectyraNative load(String explicitPath) {
    String path = explicitPath != null && !explicitPath.isBlank() ? explicitPath : env("SPECTYRA_FFI_PATH");
    if (path == null || path.isBlank()) {
      throw new IllegalStateException("Set SPECTYRA_FFI_PATH or pass explicitPath to SpectyraNative.load");
    }
    SpectyraLib lib = Native.load(path, SpectyraLib.class);
    return new SpectyraNative(lib);
  }

  private static String env(String k) {
    String v = System.getenv(k);
    return v == null ? null : v.trim();
  }

  /** UTF-8 JSON in/out for {@code spectyra_run_chat_pipeline_json}. */
  public String runChatPipelineJson(String jsonUtf8) {
    byte[] raw = jsonUtf8.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    byte[] in = java.util.Arrays.copyOf(raw, raw.length + 1);
    Pointer out = lib.spectyra_run_chat_pipeline_json(in);
    if (out == null) {
      throw new IllegalStateException("spectyra_run_chat_pipeline_json returned null");
    }
    try {
      return out.getString(0, "UTF-8");
    } finally {
      lib.spectyra_free_string(out);
    }
  }
}
