package ai.spectyra.sdk;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SpectyraConfigTest {
  @Test
  void defaultRuntimeBase() {
    SpectyraConfig c = SpectyraConfig.runtimeDefaults();
    assertTrue(c.getRuntimeBaseUrl().startsWith("http"));
  }
}
