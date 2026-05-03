import type { IncomingMessage, ServerResponse } from "node:http";
import { createSpectyraDevBridgeConnectMiddleware } from "../monitor/localDevServer.js";
import type { SpectyraLocalDevServerConfig } from "../types.js";
import { getAutoMonitorEngine } from "./stateShared.js";

export type { SpectyraLocalDevServerConfig };

/** Minimal Connect / Express `app.use` shape. */
export type ConnectStyleApp = {
  use: (
    middleware: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void,
  ) => void;
};

/**
 * Mounts the Spectyra dev HTTP bridge (`/__spectyra/*`) on your Node server using the
 * same {@link getAutoMonitorEngine} instance as `@spectyra/sdk/auto`.
 */
export function useSpectyraAutoDevBridge(app: ConnectStyleApp, options?: SpectyraLocalDevServerConfig): void {
  app.use(createSpectyraDevBridgeConnectMiddleware(() => getAutoMonitorEngine(), options));
}
