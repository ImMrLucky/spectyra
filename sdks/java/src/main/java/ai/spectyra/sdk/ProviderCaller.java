package ai.spectyra.sdk;

import java.util.List;
import java.util.Map;

/** Called with optimized messages after the Rust pipeline (embedded mode). */
@FunctionalInterface
public interface ProviderCaller {
  /** Return provider response body as JSON text (object or string). */
  String call(List<Map<String, String>> optimizedMessages) throws Exception;
}
