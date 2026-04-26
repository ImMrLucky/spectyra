export function newCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
