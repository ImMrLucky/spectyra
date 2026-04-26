/**
 * Optional OpenClaw host surface — real gateways may expose subsets.
 * The adapter only uses duck-typing; missing members are skipped.
 */
export type OpenClawHost = Record<string, unknown>;

export interface OpenClawAdapterResult {
  dispose(): void;
}
