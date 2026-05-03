/**
 * @packageDocumentation
 * Compatibility wrapper — prefer `@spectyra/sdk` (`import "@spectyra/sdk/auto"` and `@spectyra/sdk/overlay`).
 */

export { mountSpectyraDevtools, shouldMountDevtoolsByDefault } from "@spectyra/sdk";
export type { SpectyraDevtoolsMountHandle } from "@spectyra/sdk";

import "@spectyra/sdk/overlay";
export { SpectyraMonitorStrip, SpectyraOverlay } from "@spectyra/sdk/overlay";
