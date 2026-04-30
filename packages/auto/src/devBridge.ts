import type { IncomingMessage, ServerResponse } from "node:http";
import { createSpectyraDevBridgeConnectMiddleware } from "@spectyra/sdk";
import type { SpectyraLocalDevServerConfig } from "@spectyra/sdk";
import { getAutoMonitorEngine } from "./state.js";

export type { SpectyraLocalDevServerConfig };

/** Minimal Connect / Express `app.use` shape. */
export type ConnectStyleApp = {
  use: (
    middleware: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void,
  ) => void;
};

/**
 * Mounts the Spectyra dev HTTP bridge (`/__spectyra/*`) on your Node server using the
 * same {@link getAutoMonitorEngine} instance as `@spectyra/auto`.
 *
 * Pair with the browser entry `import "@spectyra/devtools/auto"` (or `<spectyra-overlay>`).
 */
export function useSpectyraAutoDevBridge(app: ConnectStyleApp, options?: SpectyraLocalDevServerConfig): void {
  app.use(createSpectyraDevBridgeConnectMiddleware(() => getAutoMonitorEngine(), options));
}
