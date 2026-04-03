/**
 * Local Companion runtime — generic integration metadata.
 *
 * Optimization operates on canonical messages + mode inside `optimizer.ts` / the optimization engine.
 * Adapter-specific parsing stays at the HTTP boundary (OpenClaw, future Claude Agent SDK, etc.).
 */

/** Declared integration for tracing; does not change optimization math. */
export type LocalCompanionIntegrationName = "openclaw" | "cursor" | "vscode" | "generic" | string;
