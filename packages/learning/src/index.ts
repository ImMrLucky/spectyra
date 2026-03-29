export {
  createEmptyProfile,
  applyUpdate,
  recordStablePattern,
  toHistoricalSignals,
  getDetectorCalibration,
  calibrateDetector,
} from "./local-profile.js";

export {
  createEmptySnapshot,
  aggregateProfiles,
  getGlobalDefault,
  getGlobalDetectorThreshold,
} from "./global-snapshot.js";

export {
  TRANSFORMS_SUBJECT_TO_LEARNING_GATE,
  shouldSkipTransformForLearning,
} from "./transform-gate.js";
export type { LearningGateOptions } from "./transform-gate.js";

export {
  mergeCalibrationForDetection,
  learningUpdatesFromPipelineRun,
} from "./pipeline-feedback.js";
