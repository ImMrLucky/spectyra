/**
 * @deprecated Use openAiSseProxyTransform from ./sseOpenAiProxy.js (with onUsage for streaming metrics).
 */
import { openAiSseProxyTransform } from "./sseOpenAiProxy.js";
import type { Transform } from "node:stream";

export function sseSpectyraModelRewriteTransform(clientModelId: string): Transform {
  return openAiSseProxyTransform({ spectyraAlias: clientModelId, onUsage: undefined });
}

export { openAiSseProxyTransform } from "./sseOpenAiProxy.js";
