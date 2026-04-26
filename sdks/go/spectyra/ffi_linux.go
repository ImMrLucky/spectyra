//go:build linux && amd64 && cgo

package spectyra

/*
#cgo LDFLAGS: -ldl
#include <dlfcn.h>
#include <stdlib.h>
#include <string.h>

typedef char* (*spectyra_run_chat_pipeline_json_t)(const char*);
typedef void (*spectyra_free_string_t)(char*);

static char* call_run(void* fn, const char* input) {
  return ((spectyra_run_chat_pipeline_json_t)fn)(input);
}

static void call_free(void* fn, char* p) {
  ((spectyra_free_string_t)fn)(p);
}
*/
import "C"

import (
	"errors"
	"fmt"
	"os"
	"unsafe"
)

// RunChatPipelineFFIJSON loads the shared library and calls spectyra_run_chat_pipeline_json.
// If libPath is empty, SPECTYRA_FFI_PATH is used.
func RunChatPipelineFFIJSON(libPath string, input []byte) ([]byte, error) {
	if libPath == "" {
		libPath = os.Getenv("SPECTYRA_FFI_PATH")
	}
	if libPath == "" {
		return nil, errors.New("SPECTYRA_FFI_PATH unset and libPath empty")
	}
	cpath := C.CString(libPath)
	defer C.free(unsafe.Pointer(cpath))
	h := C.dlopen(cpath, C.RTLD_NOW)
	if h == nil {
		return nil, fmt.Errorf("dlopen failed: %s", libPath)
	}
	defer C.dlclose(h)
	nRun := C.CString("spectyra_run_chat_pipeline_json")
	defer C.free(unsafe.Pointer(nRun))
	nFree := C.CString("spectyra_free_string")
	defer C.free(unsafe.Pointer(nFree))
	runPtr := C.dlsym(h, nRun)
	freePtr := C.dlsym(h, nFree)
	if runPtr == nil || freePtr == nil {
		return nil, errors.New("dlsym failed for spectyra exports")
	}
	in := append(append([]byte(nil), input...), 0)
	cin := (*C.char)(unsafe.Pointer(&in[0]))
	out := C.call_run(runPtr, cin)
	if out == nil {
		return nil, errors.New("spectyra_run_chat_pipeline_json returned null")
	}
	goBytes := C.GoBytes(unsafe.Pointer(out), C.int(C.strlen(out)))
	C.call_free(freePtr, out)
	return append([]byte(nil), goBytes...), nil
}
