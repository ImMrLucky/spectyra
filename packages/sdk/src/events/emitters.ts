/**
 * Normalized SDK event bus — use these for parity with Local Companion event shapes.
 * @public
 */
export {
  sdkEventEngine,
  shouldEmitSdkNormalizedEvents,
  ingestSdkSessionStart,
  ingestSdkSessionEnd,
  ingestSdkComplete,
  ingestSdkPromptComparisonAvailable,
  emitSdkEventsForStandaloneComplete,
} from "./sdkEvents.js";
