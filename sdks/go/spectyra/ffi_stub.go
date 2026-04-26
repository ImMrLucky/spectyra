//go:build !linux || !amd64 || !cgo

package spectyra

import "errors"

// ErrFFIUnavailable is returned when the optional native path is not built for this platform.
var ErrFFIUnavailable = errors.New(
	"spectyra: native FFI requires linux/amd64 with CGO and SPECTYRA_FFI_PATH (or use RunChatRuntime HTTP client)",
)

// RunChatPipelineFFIJSON calls spectyra_run_chat_pipeline_json when built with linux/amd64/cgo.
// libPath may be empty to use SPECTYRA_FFI_PATH.
func RunChatPipelineFFIJSON(_ string, _ []byte) ([]byte, error) {
	return nil, ErrFFIUnavailable
}
