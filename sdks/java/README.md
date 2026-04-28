# Spectyra Java SDK (`ai.spectyra:spectyra-sdk`)

JVM library for **runtime HTTP** (local Spectyra process) or **embedded** JNA + native `spectyra_ffi`. Prompts and provider secrets stay **BYOK / on your infrastructure** unless you explicitly choose cloud telemetry aggregates.

---

## Install

**Maven** — add the dependency:

```xml
<dependency>
  <groupId>ai.spectyra</groupId>
  <artifactId>spectyra-sdk</artifactId>
  <version>0.1.0</version>
</dependency>
```

**Gradle (Kotlin DSL):**

```kotlin
implementation("ai.spectyra:spectyra-sdk:0.1.0")
```

Requires **Java 17+**. No Git clone is required for normal use.

---

## BYOK and local-first

- **Runtime mode:** `Spectyra` POSTs to `{base}/v1/chat/run`. Configure **OpenAI / Anthropic / Groq** keys on the **Spectyra local runtime**, not in this SDK’s constructor.
- **Embedded mode:** Native library runs optimization locally; your code calls the provider.
- **Cloud:** Optional Spectyra control-plane keys are for entitlements and aggregates — not for sending your provider secret to Spectyra for inference.

---

## Hello world (runtime)

Start the **Spectyra local runtime** (e.g. `http://127.0.0.1:4269`). Then:

```java
import ai.spectyra.sdk.Spectyra;
import ai.spectyra.sdk.SpectyraConfig;
import java.util.List;
import java.util.Map;

public class Hello {
  public static void main(String[] args) throws Exception {
    Spectyra spectyra = Spectyra.create(SpectyraConfig.runtimeDefaults());
    List<Map<String, String>> messages =
        List.of(Map.of("role", "user", "content", "Hello!"));
    String raw = spectyra.runChatRuntimeRaw("openai", "gpt-4o-mini", messages);
    System.out.println(raw);
  }
}
```

`SPECTYRA_RUNTIME_URL` overrides the default base URL.

---

## Runtime mode (reference)

Use `SpectyraConfig.runtimeDefaults()` or `new SpectyraConfig(SpectyraConfig.Mode.RUNTIME, baseUrl, null)` with `Spectyra.create(...)`. Call `runChatRuntimeRaw(provider, model, messages, requestId, metadata)` for full control.

---

## Embedded mode (optional)

Build the shared library per [RUST_AND_FFI_BUILD.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/RUST_AND_FFI_BUILD.md), then:

```java
Spectyra spectyra =
    Spectyra.create(SpectyraConfig.embeddedDefaults("/path/to/libspectyra_ffi.dylib"));
// Use spectyra.runChat(...) with entitlement JSON and your provider callback — see Spectyra.java.
```

---

## Contributing

**Clone this repository only if you are developing or modifying the Java SDK** (or running its tests).

```bash
git clone https://github.com/spectyra/spectyra.git
cd spectyra/sdks/java
mvn test
```

Normal applications should depend on **`ai.spectyra:spectyra-sdk`** from Maven Central.

---

## More documentation

- [docs/sdk/README.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/README.md)
