using System.Runtime.InteropServices;
using System.Text;

namespace Spectyra;

/// <summary>Optional P/Invoke to <c>spectyra_ffi</c> (same contract as Python <c>ctypes</c> scaffold).</summary>
public sealed class SpectyraFfi : IDisposable
{
    private readonly IntPtr _lib;
    private readonly RunChatPipelineJsonDelegate _run;
    private readonly FreeStringDelegate _free;
    private bool _disposed;

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate IntPtr RunChatPipelineJsonDelegate(IntPtr inputUtf8NullTerminated);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate void FreeStringDelegate(IntPtr p);

    private SpectyraFfi(IntPtr lib, RunChatPipelineJsonDelegate run, FreeStringDelegate free)
    {
        _lib = lib;
        _run = run;
        _free = free;
    }

    /// <summary>Load from <c>SPECTYRA_FFI_PATH</c> or explicit path (full path to .dll/.so/.dylib).</summary>
    public static SpectyraFfi Load(string? path = null)
    {
        var p = string.IsNullOrWhiteSpace(path) ? Environment.GetEnvironmentVariable("SPECTYRA_FFI_PATH") : path;
        if (string.IsNullOrWhiteSpace(p))
        {
            throw new InvalidOperationException("Set SPECTYRA_FFI_PATH or pass path to SpectyraFfi.Load");
        }

        if (!NativeLibrary.TryLoad(p, out var lib))
        {
            throw new DllNotFoundException($"Could not load spectyra FFI: {p}");
        }

        var run = NativeLibrary.GetExport(lib, "spectyra_run_chat_pipeline_json");
        var free = NativeLibrary.GetExport(lib, "spectyra_free_string");
        return new SpectyraFfi(
            lib,
            Marshal.GetDelegateForFunctionPointer<RunChatPipelineJsonDelegate>(run),
            Marshal.GetDelegateForFunctionPointer<FreeStringDelegate>(free));
    }

    /// <summary>UTF-8 JSON in/out for <c>spectyra_run_chat_pipeline_json</c>.</summary>
    public string RunChatPipelineJson(string jsonUtf8)
    {
        var bytes = Encoding.UTF8.GetBytes(jsonUtf8 + "\0");
        var pinned = GCHandle.Alloc(bytes, GCHandleType.Pinned);
        try
        {
            var ptr = _run(pinned.AddrOfPinnedObject());
            if (ptr == IntPtr.Zero)
            {
                throw new InvalidOperationException("spectyra_run_chat_pipeline_json returned null");
            }

            try
            {
                return Marshal.PtrToStringUTF8(ptr) ?? "";
            }
            finally
            {
                _free(ptr);
            }
        }
        finally
        {
            pinned.Free();
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        if (_lib != IntPtr.Zero)
        {
            NativeLibrary.Free(_lib);
        }
    }
}
