# Spectyra Go SDK (`github.com/spectyra/spectyra-go`)

Small HTTP client for **Spectyra local runtime** `POST /v1/chat/run`. **BYOK:** provider keys live on the runtime you operate, not in Spectyra’s cloud.

---

## Install

```bash
go get github.com/spectyra/spectyra-go@v0.1.0
```

In your module:

```go
import "github.com/spectyra/spectyra-go/spectyra"
```

No Git clone is required for normal use (Go modules fetch from the proxy).

---

## BYOK and local-first

- **Runtime:** `NewClient` targets `SPECTYRA_RUNTIME_URL` or `http://127.0.0.1:4269`. The runtime holds provider credentials for outbound model calls.
- **Embedded:** Use `session.go` / FFI helpers when you ship `libspectyra_ffi` — see [RUST_AND_FFI_BUILD.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/RUST_AND_FFI_BUILD.md).
- **Cloud:** Optional Spectyra API keys are for control-plane and aggregates, not for taking possession of your provider secret.

---

## Hello world (runtime)

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/spectyra/spectyra-go/spectyra"
)

func main() {
	ctx := context.Background()
	c := spectyra.NewClient(spectyra.Config{RuntimeBaseURL: "http://127.0.0.1:4269"})
	env, err := c.RunChatRuntime(ctx, "openai", "gpt-4o-mini", []spectyra.Message{
		{Role: "user", Content: "Hello!"},
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(env))
	var pretty map[string]any
	_ = json.Unmarshal(env, &pretty)
}
```

---

## Runtime mode (reference)

`RunChatRuntime` sends JSON `{"provider","model","messages"}` to `/v1/chat/run`. Extend the request in your fork if you need metadata fields matching the OpenAPI contract.

---

## Contributing

**Clone this repository only if you are developing or modifying the Go SDK.**

```bash
git clone https://github.com/spectyra/spectyra.git
cd spectyra/sdks/go
go test ./...
```

Normal services should depend on **`github.com/spectyra/spectyra-go`** via `go get` / `go.mod`.

---

## More documentation

- [docs/sdk/README.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/README.md)
