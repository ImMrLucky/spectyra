/**
 * Maps thrown inference errors to HTTP responses without leaking secrets.
 */

export function mapCompanionInferenceError(err: unknown): { status: number; body: Record<string, unknown> } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (msg.includes("Unknown Spectyra model alias") || msg.includes("Invalid provider")) {
    return {
      status: 400,
      body: {
        error: {
          type: "unsupported_model_alias",
          message: msg,
        },
      },
    };
  }

  if (msg.includes("Provider key not configured")) {
    return {
      status: 503,
      body: {
        error: {
          type: "provider_not_configured",
          message: msg,
        },
      },
    };
  }

  if (lower.includes("api error: 401") || lower.includes("401")) {
    return {
      status: 502,
      body: {
        error: {
          type: "provider_auth_failed",
          message: "Upstream provider rejected the API key or credentials.",
        },
      },
    };
  }

  if (lower.includes("unsupported provider")) {
    return {
      status: 400,
      body: {
        error: {
          type: "unsupported_provider",
          message: msg,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        type: "companion_error",
        message: msg,
      },
    },
  };
}
