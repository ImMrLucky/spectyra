export { activateSpectyraPlugin } from "./plugin.js";
export { default } from "./plugin.js";
export {
  CompanionClient,
  openClawLatestOkToView,
  SPECTYRA_COMPANION_BASE,
} from "./companion/companion-client.js";
export { LatestSavingsCoordinator } from "./companion/latest-savings-coordinator.js";
export { isFreshOpenClawTimestamp, SEAMLESS_SAVINGS_MAX_AGE_MS } from "./companion/seamless-helpers.js";
export type {
  CompanionHealth,
  CompanionConnectionState,
  OpenClawLatestOk,
  OpenClawLatestResponse,
  SpectyraFlowSummary,
  SpectyraTraceSavingsView,
} from "./companion/companion-types.js";
export {
  scanPrompt,
  scanPromptSecurity,
  mergePromptScanResults,
  buildSecurityScanEventPayload,
  buildToolRiskEventPayload,
} from "./security/prompt-security-scanner.js";
export type {
  PromptSecurityScanResult,
  ScanPromptResult,
  SecurityFinding,
  SecurityLevel,
  SecuritySeverity,
  SecurityRecommendedAction,
} from "./security/security-types.js";
export { RECOMMENDED_ACTIONS_BY_CATEGORY, recommendedActionsForCategories } from "./security/security-recommended-actions.js";
export { createOpenClawAdapter } from "./openclaw/openclaw-adapter.js";
export { resolveSavingsBadgeView, buildSavingsBadgeDescriptor } from "./ui/spectyra-savings-badge.js";
export {
  runSanitizeCopyAction,
  formatSecurityNoticeMarkdown,
  shouldShowNonBlockingSecurityNotice,
  SECURITY_ALERT_ALLOWED_ACTION_LABELS,
  SECURITY_NOTICE_FORBIDDEN_BUTTON_SUBSTRINGS,
} from "./ui/spectyra-security-alert.js";
export { extractPromptText, runBeforeMessageSendHook, beforeMessageSend } from "./hooks/message-hooks.js";
export { formatSpectyraStatusMarkdown, formatStatusCommandText } from "./ui/spectyra-status-panel.js";
