package spectyra

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type Config struct {
	RuntimeBaseURL string
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client struct {
	base   string
	client *http.Client
}

func NewClient(cfg Config) *Client {
	base := strings.TrimSuffix(cfg.RuntimeBaseURL, "/")
	if base == "" {
		base = strings.TrimSuffix(os.Getenv("SPECTYRA_RUNTIME_URL"), "/")
	}
	if base == "" {
		base = "http://127.0.0.1:4269"
	}
	return &Client{
		base: base,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// RunChatRuntime POSTs /v1/chat/run (provider keys on the runtime).
func (c *Client) RunChatRuntime(ctx context.Context, provider, model string, messages []Message) (json.RawMessage, error) {
	body := map[string]any{
		"provider": provider,
		"model":    model,
		"messages": messages,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/chat/run", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("spectyra runtime: %s", res.Status)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(res.Body); err != nil {
		return nil, err
	}
	return json.RawMessage(buf.Bytes()), nil
}
