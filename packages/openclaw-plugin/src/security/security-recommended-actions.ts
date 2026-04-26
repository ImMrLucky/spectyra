import type { SecurityFindingCategory, SecurityRecommendedAction } from "./security-types.js";

export const RECOMMENDED_ACTIONS_BY_CATEGORY: Record<
  SecurityFindingCategory,
  readonly SecurityRecommendedAction[]
> = {
  api_key: ["remove_secret", "rotate_secret_if_sent", "use_env_reference"],
  cloud_secret: ["remove_secret", "rotate_secret_if_sent", "use_env_reference"],
  private_key: ["remove_secret", "rotate_secret_if_sent"],
  auth_token: ["remove_secret", "rotate_secret_if_sent"],
  database_url: ["remove_secret", "rotate_secret_if_sent", "use_env_reference"],
  env_file: ["redact_sensitive_text", "use_env_reference"],
  internal_url: ["verify_tool_destination"],
  large_private_context: ["limit_private_context", "review_before_sending"],
  personal_data: ["redact_sensitive_text", "review_before_sending"],
  tool_risk: ["verify_tool_destination"],
  unknown: ["review_before_sending"],
};

export function recommendedActionsForCategories(
  categories: SecurityFindingCategory[],
): SecurityRecommendedAction[] {
  const out = new Set<SecurityRecommendedAction>();
  for (const c of categories) {
    for (const a of RECOMMENDED_ACTIONS_BY_CATEGORY[c] ?? RECOMMENDED_ACTIONS_BY_CATEGORY.unknown) {
      out.add(a);
    }
  }
  return [...out];
}
