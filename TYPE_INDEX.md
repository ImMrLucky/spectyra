# Type Index

Generated: 2026-01-28T06:32:17.797Z

## Summary
- Total declarations: 190
  - Interfaces: 166
  - Type aliases: 24
  - Enums: 0
- Unique names: 190

## Declarations (A-Z)

### AdminOrg

- **interface** — `apps/web/src/app/core/api/admin.service.ts:6`
  - signature: `extends=[] props=[created_at,id,name,sdk_access_enabled,stats?,stripe_customer_id,subscription_status,trial_ends_at]`
  - preview: interface AdminOrg { created_at, id, name, sdk_access_enabled, stats?, stripe_customer_id, subscription_status, trial_ends_at }

### AdminOrgDetail

- **interface** — `apps/web/src/app/core/api/admin.service.ts:21`
  - signature: `extends=[AdminOrg] props=[api_keys,projects,stats]`
  - preview: interface AdminOrgDetail { api_keys, projects, stats }

### AdminUser

- **interface** — `apps/web/src/app/core/api/admin.service.ts:42`
  - signature: `extends=[] props=[email?,orgs,user_id]`
  - preview: interface AdminUser { email?, orgs, user_id }

### AgentDecision

- **interface** — `packages/shared/src/agentTypes.ts:46`
  - signature: `extends=[] props=[options,reasons]`
  - preview: interface AgentDecision { options, reasons }

### AgentEventRequest

- **interface** — `packages/sdk/src/types.ts:129`
  - signature: `extends=[] props=[event,run_id]`
  - preview: interface AgentEventRequest { event, run_id }

### AgentEventResponse

- **interface** — `packages/sdk/src/types.ts:134`
  - signature: `extends=[] props=[ok]`
  - preview: interface AgentEventResponse { ok }

### AgentOptionsRequest

- **interface** — `packages/sdk/src/types.ts:114`
  - signature: `extends=[] props=[preferences?,prompt_meta,run_id?]`
  - preview: interface AgentOptionsRequest { preferences?, prompt_meta, run_id? }

### AgentOptionsResponse

- **interface** — `packages/sdk/src/types.ts:123`
  - signature: `extends=[] props=[options,reasons,run_id]`
  - preview: interface AgentOptionsResponse { options, reasons, run_id }

### ApiError

- **interface** — `packages/sdk/src/remote/http.ts:9`
  - signature: `extends=[] props=[details?,error]`
  - preview: interface ApiError { details?, error }

### ApiKey

- **interface** — `packages/shared/src/types.ts:58`
  - signature: `extends=[] props=[allowed_ip_ranges,allowed_origins,created_at,description,expires_at,id,key_hash,key_prefix,last_used_at,name,org_id,project_id,revoked_at,scopes]`
  - preview: interface ApiKey { allowed_ip_ranges, allowed_origins, created_at, description, expires_at, id, key_hash, key_prefix, last_used_at, name, org_id, project_id, ... }

### ApiKeyDisplay

- **type** — `packages/shared/src/orgTypes.ts:80`
  - signature: `type=ApiKeySummary`
  - preview: type ApiKeyDisplay = ApiKeySummary

### ApiKeySummary

- **interface** — `packages/shared/src/orgTypes.ts:66`
  - signature: `extends=[] props=[created_at,id,last_used_at,name,project_id,revoked_at]`
  - preview: interface ApiKeySummary { created_at, id, last_used_at, name, project_id, revoked_at }

### ApplyInlineRefsInput

- **interface** — `apps/api/src/services/optimizer/transforms/refPack.ts:31`
  - signature: `extends=[] props=[messages,refPack,spectral,units]`
  - preview: interface ApplyInlineRefsInput { messages, refPack, spectral, units }

### ApplyInlineRefsOutput

- **interface** — `apps/api/src/services/optimizer/transforms/refPack.ts:38`
  - signature: `extends=[] props=[messages,replacementsMade]`
  - preview: interface ApplyInlineRefsOutput { messages, replacementsMade }

### AuditAction

- **type** — `apps/api/src/services/audit/audit.ts:14`
  - signature: `type=| "LOGIN"
  | "LOGOUT"
  | "KEY_CREATED"
  | "KEY_ROTATED"
  | "KEY_REVOKED"
  | "SETTINGS_UPDATED"
  | "EXPORT_DATA"
  | "PROVIDER_KEY_SET"`
  - preview: type AuditAction = | "LOGIN"
  | "LOGOUT"
  | "KEY_CREATED"
  | "KEY_ROTATED"
  | "KEY_REVOKED"
  | "SETTINGS_UPDATED"
  | "EXPORT_DATA"
  | "PROVIDER_KEY_SET"...

### AuditLog

- **interface** — `apps/web/src/app/features/audit/audit.page.ts:9`
  - signature: `extends=[] props=[action,actor_id,actor_type,created_at,id,ip,metadata,org_id,project_id,target_id,target_type,user_agent]`
  - preview: interface AuditLog { action, actor_id, actor_type, created_at, id, ip, metadata, org_id, project_id, target_id, target_type, user_agent }

### AuditOptions

- **interface** — `apps/api/src/services/audit/audit.ts:44`
  - signature: `extends=[] props=[ip?,metadata?,projectId?,targetId?,targetType?,userAgent?]`
  - preview: interface AuditOptions { ip?, metadata?, projectId?, targetId?, targetType?, userAgent? }

### AuditTargetType

- **type** — `apps/api/src/services/audit/audit.ts:34`
  - signature: `type=| "API_KEY"
  | "ORG"
  | "PROJECT"
  | "PROVIDER_KEY"
  | "ORG_SETTINGS"
  | "PROJECT_SETTINGS"
  | "ORG_MEMBERSHIP"
  | "AUDIT_LOG"`
  - preview: type AuditTargetType = | "API_KEY"
  | "ORG"
  | "PROJECT"
  | "PROVIDER_KEY"
  | "ORG_SETTINGS"
  | "PROJECT_SETTINGS"
  | "ORG_MEMBERSHIP"
  | "AUDIT_LOG"

### AuthenticatedRequest

- **interface** — `apps/api/src/middleware/auth.ts:63`
  - signature: `extends=[Request] props=[auth?,context?]`
  - preview: interface AuthenticatedRequest { auth?, context? }

### AuthState

- **interface** — `apps/web/src/app/core/auth/auth.service.ts:11`
  - signature: `extends=[] props=[apiKey,hasAccess,trialActive,user]`
  - preview: interface AuthState { apiKey, hasAccess, trialActive, user }

### BaselineEstimate

- **interface** — `apps/api/src/services/savings/estimateBaseline.ts:5`
  - signature: `extends=[] props=[costUsd,sampleSize,source,totalTokens]`
  - preview: interface BaselineEstimate { costUsd, sampleSize, source, totalTokens }

### BaselineSample

- **interface** — `apps/api/src/services/savings/baselineSampler.ts:10`
  - signature: `extends=[] props=[M2_cost,M2_tokens,mean_cost_usd,mean_total_tokens,n,org_id?,project_id?,updated_at,var_cost_usd,var_total_tokens,workload_key]`
  - preview: interface BaselineSample { M2_cost, M2_tokens, mean_cost_usd, mean_total_tokens, n, org_id?, project_id?, updated_at, var_cost_usd, var_total_tokens, workload_key }

### BillingStatus

- **interface** — `packages/shared/src/uiTypes.ts:10`
  - signature: `extends=[] props=[has_access,org,subscription_active,subscription_status,trial_active,trial_ends_at]`
  - preview: interface BillingStatus { has_access, org, subscription_active, subscription_status, trial_active, trial_ends_at }

### BillingStatusDisplay

- **type** — `apps/web/src/app/features/usage/usage.page.ts:29`
  - signature: `type=BillingStatusPartial`
  - preview: type BillingStatusDisplay = BillingStatusPartial

### BillingStatusPartial

- **interface** — `packages/shared/src/uiTypes.ts:26`
  - signature: `extends=[] props=[has_access?,subscription_active?,subscription_status?,trial_ends_at?]`
  - preview: interface BillingStatusPartial { has_access?, subscription_active?, subscription_status?, trial_ends_at? }

### BudgetProgress

- **interface** — `apps/web/src/app/features/usage/usage.page.ts:18`
  - signature: `extends=[] props=[budget_type,limit,period,remaining,used]`
  - preview: interface BudgetProgress { budget_type, limit, period, remaining, used }

### Budgets

- **interface** — `apps/api/src/services/optimizer/budgeting/budgetsFromSpectral.ts:14`
  - signature: `extends=[] props=[codemapDetailLevel,compressionAggressiveness,keepLastTurns,maxRefpackEntries,phrasebookAggressiveness]`
  - preview: interface Budgets { codemapDetailLevel, compressionAggressiveness, keepLastTurns, maxRefpackEntries, phrasebookAggressiveness }

### BudgetsFromSpectralInput

- **interface** — `apps/api/src/services/optimizer/budgeting/budgetsFromSpectral.ts:22`
  - signature: `extends=[] props=[baseKeepLastTurns?,baseMaxRefs?,spectral]`
  - preview: interface BudgetsFromSpectralInput { baseKeepLastTurns?, baseMaxRefs?, spectral }

### BuildGraphInput

- **interface** — `apps/api/src/services/optimizer/buildGraph.ts:5`
  - signature: `extends=[] props=[opts,path,units]`
  - preview: interface BuildGraphInput { opts, path, units }

### CacheEntry

- **interface** — `apps/api/src/services/optimizer/cache/memoryCacheStore.ts:10`
  - signature: `extends=[] props=[expiresAt,value]`
  - preview: interface CacheEntry { expiresAt, value }

### CacheStore

- **interface** — `apps/api/src/services/optimizer/cache/cacheStore.ts:8`
  - signature: `extends=[] props=[]`
  - preview: interface CacheStore {  }

### CaptureRepoContextOptions

- **interface** — `packages/spectyra-agents/src/repoContext.ts:15`
  - signature: `extends=[] props=[changedFiles?,entrypoints?,excludeGlobs?,includeGlobs?,languageHint?,maxBytes?,rootPath]`
  - preview: interface CaptureRepoContextOptions { changedFiles?, entrypoints?, excludeGlobs?, includeGlobs?, languageHint?, maxBytes?, rootPath }

### ChatMessage

- **interface** — `packages/shared/src/types.ts:27`
  - signature: `extends=[] props=[content,role]`
  - preview: interface ChatMessage { content, role }

### ChatOptions

- **interface** — `packages/sdk/src/types.ts:194`
  - signature: `extends=[] props=[conversation_id?,dry_run?,messages,model,optimization_level?,path]`
  - preview: interface ChatOptions { conversation_id?, dry_run?, messages, model, optimization_level?, path }

### ChatProvider

- **interface** — `packages/shared/src/providerTypes.ts:11`
  - signature: `extends=[] props=[models,name,supportsUsage]`
  - preview: interface ChatProvider { models, name, supportsUsage }

### ChatRemoteConfig

- **interface** — `packages/sdk/src/remote/chatRemote.ts:10`
  - signature: `extends=[] props=[apiKey,endpoint,provider,providerKey]`
  - preview: interface ChatRemoteConfig { apiKey, endpoint, provider, providerKey }

### ChatResponse

- **interface** — `packages/sdk/src/types.ts:147`
  - signature: `extends=[] props=[cost_usd,created_at,id,mode,model,optimization_level,path,provider,quality?,response_text,savings?,usage]`
  - preview: interface ChatResponse { cost_usd, created_at, id, mode, model, optimization_level, path, provider, quality?, response_text, savings?, usage }

### ClaudeAgentOptions

- **interface** — `packages/shared/src/agentTypes.ts:10`
  - signature: `extends=[] props=[allowedTools?,canUseTool?,cwd?,maxBudgetUsd?,model?,permissionMode?]`
  - preview: interface ClaudeAgentOptions { allowedTools?, canUseTool?, cwd?, maxBudgetUsd?, model?, permissionMode? }

### ClaudeLikeMessage

- **type** — `packages/spectyra-agents/src/types.ts:45`
  - signature: `type=| { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string }
  | { role: "tool"; tool_name: string; content: st`
  - preview: type ClaudeLikeMessage = | { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string }
  | { role: "tool"; tool_name: string; content: st...

### ClaudeWrapperConfig

- **interface** — `packages/spectyra-agents/src/claude.ts:14`
  - signature: `extends=[] props=[apiEndpoint?,apiKey?]`
  - preview: interface ClaudeWrapperConfig { apiEndpoint?, apiKey? }

### CodeMap

- **interface** — `apps/api/src/services/optimizer/transforms/codeMap.ts:14`
  - signature: `extends=[] props=[dependencies,exports,imports,snippets,symbols]`
  - preview: interface CodeMap { dependencies, exports, imports, snippets, symbols }

### CodeMapInput

- **interface** — `apps/api/src/services/optimizer/transforms/codeMap.ts:22`
  - signature: `extends=[] props=[detailLevel,messages,spectral]`
  - preview: interface CodeMapInput { detailLevel, messages, spectral }

### CodeMapOutput

- **interface** — `apps/api/src/services/optimizer/transforms/codeMap.ts:28`
  - signature: `extends=[] props=[changed,codeMap,messages,omittedBlocks?,tokensAfter,tokensBefore]`
  - preview: interface CodeMapOutput { changed, codeMap, messages, omittedBlocks?, tokensAfter, tokensBefore }

### CodePolicyInput

- **interface** — `apps/api/src/services/optimizer/policies/codePolicy.ts:20`
  - signature: `extends=[] props=[messages,opts,spectral,units]`
  - preview: interface CodePolicyInput { messages, opts, spectral, units }

### CodePolicyOptions

- **interface** — `apps/api/src/services/optimizer/policies/codePolicy.ts:11`
  - signature: `extends=[] props=[codeSlicerAggressive?,keepLastTurns?,maxRefs,patchModeAggressiveOnReuse,patchModeDefault,trimAggressive]`
  - preview: interface CodePolicyOptions { codeSlicerAggressive?, keepLastTurns?, maxRefs, patchModeAggressiveOnReuse, patchModeDefault, trimAggressive }

### CodePolicyOutput

- **interface** — `apps/api/src/services/optimizer/policies/codePolicy.ts:27`
  - signature: `extends=[] props=[debug,messagesFinal]`
  - preview: interface CodePolicyOutput { debug, messagesFinal }

### CodeSlicerInput

- **interface** — `apps/api/src/services/optimizer/transforms/codeSlicer.ts:3`
  - signature: `extends=[] props=[aggressive,messages]`
  - preview: interface CodeSlicerInput { aggressive, messages }

### CodeSlicerOutput

- **interface** — `apps/api/src/services/optimizer/transforms/codeSlicer.ts:8`
  - signature: `extends=[] props=[changed,messages,metadata?]`
  - preview: interface CodeSlicerOutput { changed, messages, metadata? }

### ContextCompactionInput

- **interface** — `apps/api/src/services/optimizer/transforms/contextCompaction.ts:4`
  - signature: `extends=[] props=[aggressive,keepLastTurns,maxRefs,messages,path,stableUnitIds,units]`
  - preview: interface ContextCompactionInput { aggressive, keepLastTurns, maxRefs, messages, path, stableUnitIds, units }

### ContextCompactionOutput

- **interface** — `apps/api/src/services/optimizer/transforms/contextCompaction.ts:14`
  - signature: `extends=[] props=[messages,refsUsed]`
  - preview: interface ContextCompactionOutput { messages, refsUsed }

### ConversationMetrics

- **interface** — `apps/api/src/services/optimizer/spectral/spectralCore.ts:22`
  - signature: `extends=[] props=[avgStabilityPast5Turns?,contradictionTrend?]`
  - preview: interface ConversationMetrics { avgStabilityPast5Turns?, contradictionTrend? }

### ConversationState

- **interface** — `packages/shared/src/types.ts:106`
  - signature: `extends=[] props=[conversationId,lastTurn,path,units]`
  - preview: interface ConversationState { conversationId, lastTurn, path, units }

### CreateAgentRunInput

- **interface** — `apps/api/src/services/agent/agentRepo.ts:10`
  - signature: `extends=[] props=[allowedTools,maxBudgetUsd,model,orgId,permissionMode,projectId,promptMeta,reasons,runId]`
  - preview: interface CreateAgentRunInput { allowedTools, maxBudgetUsd, model, orgId, permissionMode, projectId, promptMeta, reasons, runId }

### CurvatureStats

- **interface** — `apps/api/src/services/optimizer/spectral/curvature.ts:11`
  - signature: `extends=[] props=[curvatureAvg,curvatureMin,curvatureP10]`
  - preview: interface CurvatureStats { curvatureAvg, curvatureMin, curvatureP10 }

### DecideAgentInput

- **interface** — `packages/sdk/src/local/decideAgent.ts:10`
  - signature: `extends=[] props=[config,ctx,prompt]`
  - preview: interface DecideAgentInput { config, ctx, prompt }

### DecideAgentOptionsInput

- **interface** — `apps/api/src/services/agent/policy.ts:13`
  - signature: `extends=[] props=[orgId,preferences,projectId,promptMeta]`
  - preview: interface DecideAgentOptionsInput { orgId, preferences, projectId, promptMeta }

### DeltaPromptingInput

- **interface** — `apps/api/src/services/optimizer/transforms/deltaPrompting.ts:4`
  - signature: `extends=[] props=[enabled,messages,noteUnstableUnitIds?,path]`
  - preview: interface DeltaPromptingInput { enabled, messages, noteUnstableUnitIds?, path }

### DeltaPromptingOutput

- **interface** — `apps/api/src/services/optimizer/transforms/deltaPrompting.ts:11`
  - signature: `extends=[] props=[deltaUsed,messages]`
  - preview: interface DeltaPromptingOutput { deltaUsed, messages }

### EmbeddingProvider

- **interface** — `apps/api/src/services/embeddings/types.ts:1`
  - signature: `extends=[] props=[]`
  - preview: interface EmbeddingProvider {  }

### EmbeddingService

- **interface** — `apps/api/src/services/optimizer/optimizer.ts:26`
  - signature: `extends=[] props=[]`
  - preview: interface EmbeddingService {  }

### EncryptedKey

- **interface** — `apps/api/src/services/crypto/envelope.ts:20`
  - signature: `extends=[] props=[ciphertext,iv,kid,tag]`
  - preview: interface EncryptedKey { ciphertext, iv, kid, tag }

### GenericMessage

- **interface** — `packages/spectyra-agents/src/types.ts:61`
  - signature: `extends=[] props=[content,meta?,role]`
  - preview: interface GenericMessage { content, meta?, role }

### GenericWrapperConfig

- **interface** — `packages/spectyra-agents/src/generic.ts:14`
  - signature: `extends=[] props=[apiEndpoint?,apiKey?]`
  - preview: interface GenericWrapperConfig { apiEndpoint?, apiKey? }

### GraphEdge

- **interface** — `apps/api/src/services/optimizer/spectral/types.ts:10`
  - signature: `extends=[] props=[i,j,type,w]`
  - preview: interface GraphEdge { i, j, type, w }

### InsertAgentEventInput

- **interface** — `apps/api/src/services/agent/agentRepo.ts:22`
  - signature: `extends=[] props=[event,orgId,runId]`
  - preview: interface InsertAgentEventInput { event, orgId, runId }

### IntegrationScenario

- **interface** — `apps/web/src/app/features/integrations/integrations.page.ts:9`
  - signature: `extends=[] props=[description,detailed_guide?,id,name,quickstart,what_spectyra_controls,when_to_use]`
  - preview: interface IntegrationScenario { description, detailed_guide?, id, name, quickstart, what_spectyra_controls, when_to_use }

### IntegrationStatus

- **interface** — `apps/web/src/app/features/overview/overview.page.ts:8`
  - signature: `extends=[] props=[api,last_event_at,last_run_at,sdk_local,sdk_remote]`
  - preview: interface IntegrationStatus { api, last_event_at, last_run_at, sdk_local, sdk_remote }

### LedgerRow

- **interface** — `apps/api/src/services/savings/ledgerWriter.ts:15`
  - signature: `extends=[] props=[baseline_cost_usd,baseline_run_id?,baseline_tokens,confidence,cost_saved_usd,created_at,id,model,optimization_level,optimized_cost_usd,optimized_run_id?,optimized_tokens,path,pct_saved,provider,replay_id?,savings_type,tokens_saved,workload_key]`
  - preview: interface LedgerRow { baseline_cost_usd, baseline_run_id?, baseline_tokens, confidence, cost_saved_usd, created_at, id, model, optimization_level, optimized_cost_usd, optimized_run_id?, optimized_tokens, ... }

### LevelBreakdown

- **interface** — `apps/api/src/services/storage/savingsRepo.ts:50`
  - signature: `extends=[] props=[combined,estimated,level,verified]`
  - preview: interface LevelBreakdown { combined, estimated, level, verified }

### MeResponse

- **interface** — `apps/web/src/app/core/services/me.service.ts:7`
  - signature: `extends=[] props=[has_access,org,project?,projects?,trial_active]`
  - preview: interface MeResponse { has_access, org, project?, projects?, trial_active }

### Message

- **interface** — `packages/shared/src/types.ts:18`
  - signature: `extends=[] props=[content,role]`
  - preview: interface Message { content, role }

### ModalData

- **interface** — `apps/web/src/app/components/modal.component.ts:6`
  - signature: `extends=[] props=[cancelText?,confirmText?,message,showCancel?,title]`
  - preview: interface ModalData { cancelText?, confirmText?, message, showCancel?, title }

### Mode

- **type** — `packages/shared/src/types.ts:2`
  - signature: `type="baseline" | "optimized"`
  - preview: type Mode = "baseline" | "optimized"

### NavItem

- **interface** — `apps/web/src/app/app.component.ts:17`
  - signature: `extends=[] props=[adminOnly?,icon,label,route]`
  - preview: interface NavItem { adminOnly?, icon, label, route }

### NodeFeatures

- **interface** — `apps/api/src/services/optimizer/spectral/nodeFeatures.ts:11`
  - signature: `extends=[] props=[ageTurns,kindWeight,length,novelty]`
  - preview: interface NodeFeatures { ageTurns, kindWeight, length, novelty }

### OpenAILikeMessage

- **type** — `packages/spectyra-agents/src/types.ts:53`
  - signature: `type=| { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string }
  | { role: "tool"; name: string; content: string `
  - preview: type OpenAILikeMessage = | { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string }
  | { role: "tool"; name: string; content: string ...

### OpenAIWrapperConfig

- **interface** — `packages/spectyra-agents/src/openai.ts:14`
  - signature: `extends=[] props=[apiEndpoint?,apiKey?]`
  - preview: interface OpenAIWrapperConfig { apiEndpoint?, apiKey? }

### OptimizationLevel

- **type** — `packages/shared/src/uiTypes.ts:37`
  - signature: `type=0 | 1 | 2 | 3 | 4`
  - preview: type OptimizationLevel = 0 | 1 | 2 | 3 | 4

### OptimizationLevelConfig

- **interface** — `apps/api/src/services/optimizer/optimizationLevel.ts:7`
  - signature: `extends=[] props=[codeSlicerAggressive,compactionAggressive,keepLastTurns,maxRefs,patchModeAggressiveOnReuse,patchModeDefault,trimAggressive]`
  - preview: interface OptimizationLevelConfig { codeSlicerAggressive, compactionAggressive, keepLastTurns, maxRefs, patchModeAggressiveOnReuse, patchModeDefault, trimAggressive }

### OptimizationReportPublic

- **interface** — `packages/spectyra-agents/src/types.ts:19`
  - signature: `extends=[] props=[layers,spectral?,tokens]`
  - preview: interface OptimizationReportPublic { layers, spectral?, tokens }

### OptimizationSavings

- **interface** — `packages/shared/src/uiTypes.ts:43`
  - signature: `extends=[] props=[name,optimization,runs_count,tokens_saved]`
  - preview: interface OptimizationSavings { name, optimization, runs_count, tokens_saved }

### OptimizeAgentMessagesInput

- **interface** — `packages/spectyra-agents/src/core/optimizeAgentMessages.ts:17`
  - signature: `extends=[] props=[apiEndpoint?,apiKey?,messages,mode,repoContext?,runId?,turnIndex?]`
  - preview: interface OptimizeAgentMessagesInput { apiEndpoint?, apiKey?, messages, mode, repoContext?, runId?, turnIndex? }

### OptimizeAgentMessagesOutput

- **interface** — `packages/spectyra-agents/src/core/optimizeAgentMessages.ts:30`
  - signature: `extends=[] props=[cacheHit?,cacheKey?,debugInternal?,messages,optimizationReport]`
  - preview: interface OptimizeAgentMessagesOutput { cacheHit?, cacheKey?, debugInternal?, messages, optimizationReport }

### OptimizeInput

- **interface** — `apps/api/src/services/optimizer/optimizer.ts:55`
  - signature: `extends=[] props=[conversationId?,dryRun?,embedder,messages,mode,model,path,provider,requiredChecks?,turnIndex]`
  - preview: interface OptimizeInput { conversationId?, dryRun?, embedder, messages, mode, model, path, provider, requiredChecks?, turnIndex }

### OptimizeOutput

- **interface** — `apps/api/src/services/optimizer/optimizer.ts:73`
  - signature: `extends=[] props=[debug,debugInternal?,optimizationReport?,optimizationsApplied?,promptFinal,quality?,responseText,spectral?,tokenBreakdown?,usage?]`
  - preview: interface OptimizeOutput { debug, debugInternal?, optimizationReport?, optimizationsApplied?, promptFinal, quality?, responseText, spectral?, tokenBreakdown?, usage? }

### OptimizerChatProvider

- **interface** — `packages/shared/src/providerTypes.ts:26`
  - signature: `extends=[] props=[id]`
  - preview: interface OptimizerChatProvider { id }

### OptimizerConfig

- **interface** — `apps/api/src/services/optimizer/optimizer.ts:30`
  - signature: `extends=[] props=[codePolicy,maxOutputTokensOptimized?,maxOutputTokensOptimizedRetry?,spectral,talkPolicy,unitize]`
  - preview: interface OptimizerConfig { codePolicy, maxOutputTokensOptimized?, maxOutputTokensOptimizedRetry?, spectral, talkPolicy, unitize }

### OptimizerProvider

- **type** — `apps/api/src/services/optimizer/optimizer.ts:24`
  - signature: `type=OptimizerChatProvider`
  - preview: type OptimizerProvider = OptimizerChatProvider

### Org

- **interface** — `packages/shared/src/types.ts:35`
  - signature: `extends=[] props=[created_at,id,name,sdk_access_enabled,stripe_customer_id,subscription_status,trial_ends_at]`
  - preview: interface Org { created_at, id, name, sdk_access_enabled, stripe_customer_id, subscription_status, trial_ends_at }

### OrgDisplay

- **type** — `packages/shared/src/orgTypes.ts:78`
  - signature: `type=OrgSummary & { trial_ends_at?: string | null }`
  - preview: type OrgDisplay = OrgSummary & { trial_ends_at?: string | null }

### OrgSettings

- **type** — `apps/web/src/app/core/api/settings.service.ts:11`
  - signature: `type=OrgSettingsDTO`
  - preview: type OrgSettings = OrgSettingsDTO

### OrgSettingsDTO

- **type** — `packages/shared/src/orgTypes.ts:42`
  - signature: `type=Omit<OrgSettingsRow, "org_id" | "created_at" | "updated_at">`
  - preview: type OrgSettingsDTO = Omit<OrgSettingsRow, "org_id" | "created_at" | "updated_at">

### OrgSettingsRow

- **interface** — `packages/shared/src/orgTypes.ts:12`
  - signature: `extends=[] props=[allow_semantic_cache,allowed_email_domains,allowed_ip_ranges,created_at,data_retention_days,enforce_sso,org_id,provider_key_mode,store_internal_debug,store_prompts,store_responses,updated_at]`
  - preview: interface OrgSettingsRow { allow_semantic_cache, allowed_email_domains, allowed_ip_ranges, created_at, data_retention_days, enforce_sso, org_id, provider_key_mode, store_internal_debug, store_prompts, store_responses, updated_at }

### OrgSummary

- **interface** — `packages/shared/src/orgTypes.ts:48`
  - signature: `extends=[] props=[id,name,subscription_status,trial_ends_at?]`
  - preview: interface OrgSummary { id, name, subscription_status, trial_ends_at? }

### OrgWithTrial

- **interface** — `packages/shared/src/orgTypes.ts:55`
  - signature: `extends=[OrgSummary] props=[trial_ends_at]`
  - preview: interface OrgWithTrial { trial_ends_at }

### PatchModeInput

- **interface** — `apps/api/src/services/optimizer/transforms/patchMode.ts:3`
  - signature: `extends=[] props=[enabled,messages]`
  - preview: interface PatchModeInput { enabled, messages }

### PatchModeOutput

- **interface** — `apps/api/src/services/optimizer/transforms/patchMode.ts:8`
  - signature: `extends=[] props=[messages]`
  - preview: interface PatchModeOutput { messages }

### Path

- **type** — `packages/shared/src/types.ts:1`
  - signature: `type="talk" | "code"`
  - preview: type Path = "talk" | "code"

### PathBreakdown

- **interface** — `apps/api/src/services/storage/savingsRepo.ts:72`
  - signature: `extends=[] props=[cost_saved_usd,path,pct_saved,replays,tokens_saved]`
  - preview: interface PathBreakdown { cost_saved_usd, path, pct_saved, replays, tokens_saved }

### PathKind

- **type** — `apps/api/src/services/optimizer/spectral/types.ts:3`
  - signature: `type="talk" | "code"`
  - preview: type PathKind = "talk" | "code"

### PhraseBook

- **interface** — `apps/api/src/services/optimizer/transforms/phraseBook.ts:12`
  - signature: `extends=[] props=[entries]`
  - preview: interface PhraseBook { entries }

### PhraseBookInput

- **interface** — `apps/api/src/services/optimizer/transforms/phraseBook.ts:16`
  - signature: `extends=[] props=[aggressiveness,messages,minOccurrences?,minPhraseLength?]`
  - preview: interface PhraseBookInput { aggressiveness, messages, minOccurrences?, minPhraseLength? }

### PhraseBookOutput

- **interface** — `apps/api/src/services/optimizer/transforms/phraseBook.ts:23`
  - signature: `extends=[] props=[changed,messages,phraseBook,tokensAfter,tokensBefore]`
  - preview: interface PhraseBookOutput { changed, messages, phraseBook, tokensAfter, tokensBefore }

### Policy

- **interface** — `apps/web/src/app/features/policies/policies.page.ts:16`
  - signature: `extends=[] props=[config,created_at,enabled,id,name,type,updated_at]`
  - preview: interface Policy { config, created_at, enabled, id, name, type, updated_at }

### PolicyFormData

- **interface** — `apps/web/src/app/features/policies/policies.page.ts:26`
  - signature: `extends=[] props=[config,name,type]`
  - preview: interface PolicyFormData { config, name, type }

### PostProcessInput

- **interface** — `apps/api/src/services/optimizer/transforms/postProcess.ts:3`
  - signature: `extends=[] props=[path,preserveCodeBlocks?,text,trimLevel]`
  - preview: interface PostProcessInput { path, preserveCodeBlocks?, text, trimLevel }

### PricingConfig

- **interface** — `packages/shared/src/pricing.ts:9`
  - signature: `extends=[] props=[input_per_1k,output_per_1k]`
  - preview: interface PricingConfig { input_per_1k, output_per_1k }

### PricingConfigMap

- **interface** — `packages/shared/src/pricing.ts:18`
  - signature: `extends=[] props=[]`
  - preview: interface PricingConfigMap {  }

### Project

- **interface** — `packages/shared/src/types.ts:48`
  - signature: `extends=[] props=[created_at,id,name,org_id]`
  - preview: interface Project { created_at, id, name, org_id }

### ProjectDisplay

- **type** — `packages/shared/src/orgTypes.ts:79`
  - signature: `type=ProjectSummary`
  - preview: type ProjectDisplay = ProjectSummary

### ProjectSettings

- **type** — `apps/web/src/app/core/api/settings.service.ts:12`
  - signature: `type=ProjectSettingsDTO`
  - preview: type ProjectSettings = ProjectSettingsDTO

### ProjectSettingsDTO

- **type** — `packages/shared/src/orgTypes.ts:43`
  - signature: `type=Omit<ProjectSettingsRow, "project_id" | "created_at" | "updated_at">`
  - preview: type ProjectSettingsDTO = Omit<ProjectSettingsRow, "project_id" | "created_at" | "updated_at">

### ProjectSettingsRow

- **interface** — `packages/shared/src/orgTypes.ts:30`
  - signature: `extends=[] props=[allowed_origins,created_at,project_id,rate_limit_burst,rate_limit_rps,updated_at]`
  - preview: interface ProjectSettingsRow { allowed_origins, created_at, project_id, rate_limit_burst, rate_limit_rps, updated_at }

### ProjectSummary

- **interface** — `packages/shared/src/orgTypes.ts:59`
  - signature: `extends=[] props=[created_at?,id,name,org_id]`
  - preview: interface ProjectSummary { created_at?, id, name, org_id }

### ProjectUsage

- **interface** — `apps/web/src/app/features/usage/usage.page.ts:31`
  - signature: `extends=[] props=[calls,cost,id,name,tokens]`
  - preview: interface ProjectUsage { calls, cost, id, name, tokens }

### ProjectWithExtras

- **interface** — `apps/web/src/app/features/projects/projects.page.ts:13`
  - signature: `extends=[ProjectSummary] props=[budget?,created_at?,environments?,policy_ids?,tags?]`
  - preview: interface ProjectWithExtras { budget?, created_at?, environments?, policy_ids?, tags? }

### PromptMeta

- **interface** — `packages/sdk/src/types.ts:77`
  - signature: `extends=[] props=[filesChanged?,language?,path?,promptChars,repoId?,testCommand?]`
  - preview: interface PromptMeta { filesChanged?, language?, path?, promptChars, repoId?, testCommand? }

### ProofEstimate

- **interface** — `apps/web/src/app/features/proof/proof.page.ts:7`
  - signature: `extends=[] props=[baseline_estimate,confidence_band,explanation_summary,optimized_estimate,savings]`
  - preview: interface ProofEstimate { baseline_estimate, confidence_band, explanation_summary, optimized_estimate, savings }

### Provider

- **type** — `packages/shared/src/types.ts:3`
  - signature: `type="openai" | "anthropic" | "gemini" | "grok"`
  - preview: type Provider = "openai" | "anthropic" | "gemini" | "grok"

### ProviderCredential

- **interface** — `packages/shared/src/providerTypes.ts:60`
  - signature: `extends=[] props=[created_at,id,key_fingerprint,provider,revoked_at,updated_at]`
  - preview: interface ProviderCredential { created_at, id, key_fingerprint, provider, revoked_at, updated_at }

### ProviderCredentialRow

- **interface** — `packages/shared/src/providerTypes.ts:43`
  - signature: `extends=[] props=[created_at,id,key_ciphertext,key_fingerprint,key_kid,org_id,project_id,provider,revoked_at,updated_at]`
  - preview: interface ProviderCredentialRow { created_at, id, key_ciphertext, key_fingerprint, key_kid, org_id, project_id, provider, revoked_at, updated_at }

### ProviderInfo

- **interface** — `packages/shared/src/types.ts:8`
  - signature: `extends=[] props=[models,name,supportsUsage]`
  - preview: interface ProviderInfo { models, name, supportsUsage }

### ProviderKeyMode

- **interface** — `apps/web/src/app/core/api/provider-keys.service.ts:12`
  - signature: `extends=[] props=[provider_key_mode]`
  - preview: interface ProviderKeyMode { provider_key_mode }

### QualityCheck

- **interface** — `packages/shared/src/types.ts:142`
  - signature: `extends=[] props=[failures,pass]`
  - preview: interface QualityCheck { failures, pass }

### QualityGuardInput

- **interface** — `apps/api/src/services/optimizer/quality/qualityGuard.ts:4`
  - signature: `extends=[] props=[requiredChecks?,text]`
  - preview: interface QualityGuardInput { requiredChecks?, text }

### QualityGuardResult

- **interface** — `apps/api/src/services/optimizer/quality/qualityGuard.ts:9`
  - signature: `extends=[] props=[failures,pass]`
  - preview: interface QualityGuardResult { failures, pass }

### RecentRun

- **interface** — `apps/web/src/app/features/overview/overview.page.ts:33`
  - signature: `extends=[] props=[created_at,id,model,source,status,type]`
  - preview: interface RecentRun { created_at, id, model, source, status, type }

### RedactableRun

- **interface** — `apps/api/src/middleware/redact.ts:11`
  - signature: `extends=[] props=[debug?,debugInternal?,id?,optimizer_debug?,promptFinal?,promptHash?,run_id?,spectral_debug?,workloadKey?]`
  - preview: interface RedactableRun { debug?, debugInternal?, id?, optimizer_debug?, promptFinal?, promptHash?, run_id?, spectral_debug?, workloadKey? }

### RefPack

- **interface** — `apps/api/src/services/optimizer/transforms/refPack.ts:14`
  - signature: `extends=[] props=[entries]`
  - preview: interface RefPack { entries }

### RefPackInput

- **interface** — `apps/api/src/services/optimizer/transforms/refPack.ts:18`
  - signature: `extends=[] props=[maxEntries?,path,spectral,units]`
  - preview: interface RefPackInput { maxEntries?, path, spectral, units }

### RefPackOutput

- **interface** — `apps/api/src/services/optimizer/transforms/refPack.ts:25`
  - signature: `extends=[] props=[refPack,tokensAfter,tokensBefore]`
  - preview: interface RefPackOutput { refPack, tokensAfter, tokensBefore }

### ReplayResult

- **interface** — `packages/shared/src/types.ts:172`
  - signature: `extends=[] props=[baseline,optimized,quality,savings,scenario_id]`
  - preview: interface ReplayResult { baseline, optimized, quality, savings, scenario_id }

### RepoContext

- **type** — `packages/spectyra-agents/src/types.ts:8`
  - signature: `props=[changedFiles?,entrypoints?,files?,languageHint?,rootPath?]`
  - preview: type RepoContext = { changedFiles?, entrypoints?, files?, languageHint?, rootPath? }

### RequestContext

- **interface** — `apps/api/src/middleware/auth.ts:52`
  - signature: `extends=[] props=[apiKeyId,org,project,providerKeyFingerprint?,providerKeyOverride?,userId?,userRole?]`
  - preview: interface RequestContext { apiKeyId, org, project, providerKeyFingerprint?, providerKeyOverride?, userId?, userRole? }

### RequiredCheck

- **interface** — `packages/shared/src/scenarioSchema.ts:10`
  - signature: `extends=[] props=[flags?,name,pattern,type]`
  - preview: interface RequiredCheck { flags?, name, pattern, type }

### RequiredCheckType

- **type** — `packages/shared/src/scenarioSchema.ts:21`
  - signature: `type=RequiredCheck`
  - preview: type RequiredCheckType = RequiredCheck

### Role

- **type** — `apps/api/src/middleware/requireRole.ts:23`
  - signature: `type="OWNER" | "ADMIN" | "DEV" | "BILLING" | "VIEWER"`
  - preview: type Role = "OWNER" | "ADMIN" | "DEV" | "BILLING" | "VIEWER"

### RunDebug

- **interface** — `packages/shared/src/types.ts:131`
  - signature: `extends=[] props=[codeSliced?,deltaUsed?,first_failures?,patchMode?,refsUsed?,retry?,retry_reason?,spectral?]`
  - preview: interface RunDebug { codeSliced?, deltaUsed?, first_failures?, patchMode?, refsUsed?, retry?, retry_reason?, spectral? }

### RunRecord

- **interface** — `packages/shared/src/types.ts:154`
  - signature: `extends=[] props=[conversationId?,costUsd,createdAt,debug,id,mode,model,path,promptFinal,provider,quality,responseText,savings?,scenarioId?,usage]`
  - preview: interface RunRecord { conversationId?, costUsd, createdAt, debug, id, mode, model, path, promptFinal, provider, quality, responseText, ... }

### Savings

- **interface** — `packages/shared/src/types.ts:147`
  - signature: `extends=[] props=[costSavedUsd,pctSaved,savings_type?,tokensSaved]`
  - preview: interface Savings { costSavedUsd, pctSaved, savings_type?, tokensSaved }

### SavingsFilters

- **interface** — `apps/api/src/services/storage/savingsRepo.ts:80`
  - signature: `extends=[] props=[from?,model?,orgId?,path?,projectId?,provider?,to?]`
  - preview: interface SavingsFilters { from?, model?, orgId?, path?, projectId?, provider?, to? }

### SavingsSummary

- **interface** — `apps/api/src/services/storage/savingsRepo.ts:9`
  - signature: `extends=[] props=[combined,estimated,range,verified]`
  - preview: interface SavingsSummary { combined, estimated, range, verified }

### SavingsType

- **type** — `apps/api/src/services/savings/ledgerWriter.ts:13`
  - signature: `type="verified" | "shadow_verified" | "estimated"`
  - preview: type SavingsType = "verified" | "shadow_verified" | "estimated"

### Scenario

- **interface** — `packages/shared/src/scenarioSchema.ts:27`
  - signature: `extends=[] props=[id,path,required_checks,title,turns]`
  - preview: interface Scenario { id, path, required_checks, title, turns }

### ScenarioDTO

- **interface** — `packages/shared/src/scenarioSchema.ts:39`
  - signature: `extends=[] props=[id,path,required_checks?,title,turns?]`
  - preview: interface ScenarioDTO { id, path, required_checks?, title, turns? }

### ScenarioTurn

- **interface** — `packages/shared/src/scenarioSchema.ts:1`
  - signature: `extends=[] props=[content,role]`
  - preview: interface ScenarioTurn { content, role }

### SemanticHashInput

- **interface** — `apps/api/src/services/optimizer/cache/semanticHash.ts:12`
  - signature: `extends=[] props=[routeMeta?,spectral,units]`
  - preview: interface SemanticHashInput { routeMeta?, spectral, units }

### SemanticUnit

- **interface** — `packages/shared/src/types.ts:97`
  - signature: `extends=[] props=[createdAtTurn,embedding?,id,kind,stabilityScore,text]`
  - preview: interface SemanticUnit { createdAtTurn, embedding?, id, kind, stabilityScore, text }

### SemanticUnitKind

- **type** — `apps/api/src/services/optimizer/spectral/types.ts:5`
  - signature: `type="fact" | "constraint" | "explanation" | "code" | "patch"`
  - preview: type SemanticUnitKind = "fact" | "constraint" | "explanation" | "code" | "patch"

### SignedGraph

- **interface** — `apps/api/src/services/optimizer/spectral/types.ts:17`
  - signature: `extends=[] props=[edges,n]`
  - preview: interface SignedGraph { edges, n }

### SimulateRequest

- **interface** — `apps/web/src/app/features/policies/policies.page.ts:32`
  - signature: `extends=[] props=[model?,path,promptLength,provider?]`
  - preview: interface SimulateRequest { model?, path, promptLength, provider? }

### SliderConfig

- **interface** — `apps/web/src/app/features/run/optimization-slider.component.ts:9`
  - signature: `extends=[] props=[leftLabel,levelNames,rightLabel,title]`
  - preview: interface SliderConfig { leftLabel, levelNames, rightLabel, title }

### SpectralAnalyzeInput

- **interface** — `apps/api/src/services/optimizer/spectral/spectralCore.ts:27`
  - signature: `extends=[] props=[conversationMetrics?,currentTurn?,graph,opts,units?]`
  - preview: interface SpectralAnalyzeInput { conversationMetrics?, currentTurn?, graph, opts, units? }

### SpectralDebug

- **interface** — `packages/shared/src/types.ts:120`
  - signature: `extends=[] props=[contradictionEnergy?,lambda2?,nEdges,nNodes,recommendation,stabilityIndex,stableUnitIds,unstableUnitIds]`
  - preview: interface SpectralDebug { contradictionEnergy?, lambda2?, nEdges, nNodes, recommendation, stabilityIndex, stableUnitIds, unstableUnitIds }

### SpectralOptions

- **interface** — `apps/api/src/services/optimizer/spectral/types.ts:22`
  - signature: `extends=[] props=[contradictionEdgeWeight,maxNodes,similarityEdgeMin,tHigh,tLow]`
  - preview: interface SpectralOptions { contradictionEdgeWeight, maxNodes, similarityEdgeMin, tHigh, tLow }

### SpectralResult

- **interface** — `apps/api/src/services/optimizer/spectral/types.ts:32`
  - signature: `extends=[] props=[_internal?,contradictionEnergy,lambda2,nEdges,nNodes,recommendation,stabilityIndex,stableNodeIdx,unstableNodeIdx]`
  - preview: interface SpectralResult { _internal?, contradictionEnergy, lambda2, nEdges, nNodes, recommendation, stabilityIndex, stableNodeIdx, unstableNodeIdx }

### SpectyraClientConfig

- **interface** — `packages/sdk/src/types.ts:171`
  - signature: `extends=[] props=[apiUrl,provider,providerKey,spectyraKey]`
  - preview: interface SpectyraClientConfig { apiUrl, provider, providerKey, spectyraKey }

### SpectyraConfig

- **interface** — `packages/sdk/src/types.ts:13`
  - signature: `extends=[] props=[apiKey?,defaults?,endpoint?,mode?]`
  - preview: interface SpectyraConfig { apiKey?, defaults?, endpoint?, mode? }

### SpectyraCtx

- **interface** — `packages/sdk/src/types.ts:50`
  - signature: `extends=[] props=[budgetUsd?,orgId?,projectId?,runId?,tags?]`
  - preview: interface SpectyraCtx { budgetUsd?, orgId?, projectId?, runId?, tags? }

### SpectyraInstance

- **interface** — `packages/sdk/src/createSpectyra.ts:21`
  - signature: `extends=[] props=[]`
  - preview: interface SpectyraInstance {  }

### SpectyraMode

- **type** — `packages/sdk/src/types.ts:11`
  - signature: `type="local" | "api"`
  - preview: type SpectyraMode = "local" | "api"

### StabilityComponents

- **interface** — `apps/api/src/services/optimizer/spectral/stabilityIndex.ts:13`
  - signature: `extends=[] props=[s_curve,s_heat,s_novelty,s_rw,s_spectral]`
  - preview: interface StabilityComponents { s_curve, s_heat, s_novelty, s_rw, s_spectral }

### StabilityResult

- **interface** — `apps/api/src/services/optimizer/spectral/stabilityIndex.ts:21`
  - signature: `extends=[] props=[components,stabilityFinal]`
  - preview: interface StabilityResult { components, stabilityFinal }

### SupabaseAdminUser

- **interface** — `apps/api/src/types/supabase.ts:13`
  - signature: `extends=[] props=[app_metadata?,email?,id,user_metadata?]`
  - preview: interface SupabaseAdminUser { app_metadata?, email?, id, user_metadata? }

### SupabaseUser

- **interface** — `apps/web/src/app/core/auth/authSession.service.ts:14`
  - signature: `extends=[] props=[email?,id]`
  - preview: interface SupabaseUser { email?, id }

### TalkPolicyInput

- **interface** — `apps/api/src/services/optimizer/policies/talkPolicy.ts:16`
  - signature: `extends=[] props=[messages,opts,spectral,units]`
  - preview: interface TalkPolicyInput { messages, opts, spectral, units }

### TalkPolicyOptions

- **interface** — `apps/api/src/services/optimizer/policies/talkPolicy.ts:9`
  - signature: `extends=[] props=[compactionAggressive,keepLastTurns?,maxRefs,trimAggressive]`
  - preview: interface TalkPolicyOptions { compactionAggressive, keepLastTurns?, maxRefs, trimAggressive }

### TalkPolicyOutput

- **interface** — `apps/api/src/services/optimizer/policies/talkPolicy.ts:23`
  - signature: `extends=[] props=[debug,messagesFinal]`
  - preview: interface TalkPolicyOutput { debug, messagesFinal }

### TenantContext

- **interface** — `apps/api/src/services/storage/db.ts:185`
  - signature: `extends=[] props=[orgId,projectId?]`
  - preview: interface TenantContext { orgId, projectId? }

### TextSegment

- **interface** — `apps/api/src/services/optimizer/transforms/textGuards.ts:9`
  - signature: `extends=[] props=[content,lang?,type]`
  - preview: interface TextSegment { content, lang?, type }

### TimeseriesPoint

- **interface** — `apps/api/src/services/storage/savingsRepo.ts:31`
  - signature: `extends=[] props=[combined,date,estimated,verified]`
  - preview: interface TimeseriesPoint { combined, date, estimated, verified }

### TokenBreakdown

- **interface** — `apps/web/src/app/features/runs/runs.page.ts:9`
  - signature: `extends=[] props=[codemap?,phrasebook?,refpack?]`
  - preview: interface TokenBreakdown { codemap?, phrasebook?, refpack? }

### TokenBucket

- **interface** — `apps/api/src/middleware/rateLimit.ts:14`
  - signature: `extends=[] props=[capacity,lastRefill,refillRate,tokens]`
  - preview: interface TokenBucket { capacity, lastRefill, refillRate, tokens }

### TokenEstimate

- **interface** — `apps/api/src/services/proof/tokenEstimator.ts:9`
  - signature: `extends=[] props=[cost_usd,input_tokens,output_tokens,total_tokens]`
  - preview: interface TokenEstimate { cost_usd, input_tokens, output_tokens, total_tokens }

### TopModel

- **interface** — `apps/web/src/app/features/overview/overview.page.ts:22`
  - signature: `extends=[] props=[count,model]`
  - preview: interface TopModel { count, model }

### TopPolicy

- **interface** — `apps/web/src/app/features/overview/overview.page.ts:27`
  - signature: `extends=[] props=[name,policy_id,trigger_count]`
  - preview: interface TopPolicy { name, policy_id, trigger_count }

### UnifiedRun

- **interface** — `apps/web/src/app/features/runs/runs.page.ts:15`
  - signature: `extends=[] props=[allowed_tools?,budget,cost?,end_time,events_count?,id,mode?,model,optimizations_applied?,path?,permission_mode?,policy_triggers_count?,prompt_meta?,quality?,reasons?,savings?,source,start_time,status,token_breakdown?,tokens?,type]`
  - preview: interface UnifiedRun { allowed_tools?, budget, cost?, end_time, events_count?, id, mode?, model, optimizations_applied?, path?, permission_mode?, policy_triggers_count?, ... }

### UnitizeInput

- **interface** — `apps/api/src/services/optimizer/unitize.ts:15`
  - signature: `extends=[] props=[lastTurnIndex,messages,opts,path]`
  - preview: interface UnitizeInput { lastTurnIndex, messages, opts, path }

### UnitizeOptions

- **interface** — `apps/api/src/services/optimizer/unitize.ts:8`
  - signature: `extends=[] props=[includeSystem,maxChunkChars,maxUnits,minChunkChars]`
  - preview: interface UnitizeOptions { includeSystem, maxChunkChars, maxUnits, minChunkChars }

### Usage

- **interface** — `packages/shared/src/types.ts:113`
  - signature: `extends=[] props=[estimated?,input_tokens,output_tokens,total_tokens]`
  - preview: interface Usage { estimated?, input_tokens, output_tokens, total_tokens }

### Usage24h

- **interface** — `apps/web/src/app/features/overview/overview.page.ts:16`
  - signature: `extends=[] props=[calls,cost_estimate_usd,tokens]`
  - preview: interface Usage24h { calls, cost_estimate_usd, tokens }

### UsageData

- **interface** — `apps/web/src/app/features/usage/usage.page.ts:10`
  - signature: `extends=[] props=[by_project?,calls,cost_estimate_usd,period,tokens]`
  - preview: interface UsageData { by_project?, calls, cost_estimate_usd, period, tokens }

### User

- **interface** — `packages/shared/src/types.ts:79`
  - signature: `extends=[] props=[email,id,subscription_active,trial_ends_at]`
  - preview: interface User { email, id, subscription_active, trial_ends_at }

### UserFull

- **interface** — `packages/shared/src/types.ts:89`
  - signature: `extends=[User] props=[created_at,stripe_customer_id,subscription_id,subscription_status,updated_at]`
  - preview: interface UserFull { created_at, stripe_customer_id, subscription_id, subscription_status, updated_at }

### WorkloadKeyInput

- **interface** — `apps/api/src/services/savings/workloadKey.ts:4`
  - signature: `extends=[] props=[model,path,promptLength,provider,scenarioId?,taskType?]`
  - preview: interface WorkloadKeyInput { model, path, promptLength, provider, scenarioId?, taskType? }

### WrapClaudeRequestInput

- **interface** — `packages/spectyra-agents/src/claude.ts:22`
  - signature: `extends=[] props=[config?,messages,mode?,repoContext?,runId?]`
  - preview: interface WrapClaudeRequestInput { config?, messages, mode?, repoContext?, runId? }

### WrapClaudeRequestOutput

- **interface** — `packages/spectyra-agents/src/claude.ts:33`
  - signature: `extends=[] props=[cacheHit?,cacheKey?,messages,optimizationReport]`
  - preview: interface WrapClaudeRequestOutput { cacheHit?, cacheKey?, messages, optimizationReport }

### WrapGenericAgentLoopConfig

- **interface** — `packages/spectyra-agents/src/generic.ts:22`
  - signature: `extends=[] props=[mode?,repoContext?,runId?,spectyraConfig?]`
  - preview: interface WrapGenericAgentLoopConfig { mode?, repoContext?, runId?, spectyraConfig? }

### WrapOpenAIInputInput

- **interface** — `packages/spectyra-agents/src/openai.ts:22`
  - signature: `extends=[] props=[config?,messages,mode?,repoContext?,runId?]`
  - preview: interface WrapOpenAIInputInput { config?, messages, mode?, repoContext?, runId? }

### WrapOpenAIInputOutput

- **interface** — `packages/spectyra-agents/src/openai.ts:33`
  - signature: `extends=[] props=[cacheHit?,cacheKey?,messages,optimizationReport]`
  - preview: interface WrapOpenAIInputOutput { cacheHit?, cacheKey?, messages, optimizationReport }
