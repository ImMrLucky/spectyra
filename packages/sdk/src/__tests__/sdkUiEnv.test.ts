import assert from "node:assert";
import {
  isSpectyraProductionEnvironment,
  resolveEffectiveDebug,
  resolveEffectiveOverlay,
} from "../config/sdkUiEnv.js";

const prodCfg = { environment: "production" as const };
const devCfg = { environment: "development" as const };

assert.strictEqual(resolveEffectiveOverlay({ ...prodCfg, overlay: undefined }), false);
assert.strictEqual(resolveEffectiveOverlay({ ...prodCfg, overlay: true }), true);

assert.strictEqual(resolveEffectiveOverlay({ ...devCfg, overlay: undefined }), false);

process.env.SPECTYRA_OVERLAY = "true";
assert.strictEqual(resolveEffectiveOverlay({ ...devCfg, overlay: undefined }), true);
assert.strictEqual(resolveEffectiveOverlay({ ...prodCfg, overlay: undefined }), false);
delete process.env.SPECTYRA_OVERLAY;
assert.strictEqual(resolveEffectiveOverlay({ ...devCfg, overlay: undefined }), false);

assert.strictEqual(resolveEffectiveDebug({ environment: "production", debug: false }), false);
assert.strictEqual(resolveEffectiveDebug({ environment: "production", debug: true }), true);

assert.strictEqual(isSpectyraProductionEnvironment({ environment: "production" }), true);
assert.strictEqual(isSpectyraProductionEnvironment({ environment: "staging" }), false);

console.log("sdkUiEnv tests ok");
