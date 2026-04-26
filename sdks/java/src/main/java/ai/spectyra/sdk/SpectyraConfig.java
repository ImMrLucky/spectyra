package ai.spectyra.sdk;

/** Integration mode for non-Node backends. */
public final class SpectyraConfig {
  public enum Mode {
    RUNTIME,
    EMBEDDED
  }

  private final Mode mode;
  private final String runtimeBaseUrl;
  private final String ffiPath;

  public SpectyraConfig(Mode mode, String runtimeBaseUrl, String ffiPath) {
    this.mode = mode != null ? mode : Mode.RUNTIME;
    this.runtimeBaseUrl = runtimeBaseUrl;
    this.ffiPath = ffiPath;
  }

  public static SpectyraConfig runtimeDefaults() {
    String base = System.getenv().getOrDefault("SPECTYRA_RUNTIME_URL", "http://127.0.0.1:4269");
    return new SpectyraConfig(Mode.RUNTIME, base.replaceAll("/$", ""), null);
  }

  /** Embedded mode: load `spectyra_ffi` from {@code SPECTYRA_FFI_PATH} or explicit path. */
  public static SpectyraConfig embeddedDefaults(String ffiPath) {
    String p = ffiPath;
    if (p == null || p.isBlank()) {
      p = System.getenv("SPECTYRA_FFI_PATH");
    }
    return new SpectyraConfig(Mode.EMBEDDED, null, p);
  }

  public Mode getMode() {
    return mode;
  }

  public String getRuntimeBaseUrl() {
    return runtimeBaseUrl;
  }

  public String getFfiPath() {
    return ffiPath;
  }
}
