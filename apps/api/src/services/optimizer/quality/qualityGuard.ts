export type RequiredCheck =
  | { name: string; type: "regex"; pattern: string; flags?: string };

export interface QualityGuardInput {
  text: string;
  requiredChecks?: RequiredCheck[];
}

export interface QualityGuardResult {
  pass: boolean;
  failures: string[];
}

export function runQualityGuard(input: QualityGuardInput): QualityGuardResult {
  const { text, requiredChecks } = input;
  if (!requiredChecks || requiredChecks.length === 0) {
    return { pass: true, failures: [] };
  }

  const failures: string[] = [];
  for (const chk of requiredChecks) {
    if (chk.type === "regex") {
      try {
        const re = new RegExp(chk.pattern, chk.flags ?? "i");
        if (!re.test(text)) failures.push(chk.name);
      } catch {
        failures.push(`${chk.name} (invalid regex)`);
      }
    }
  }

  return { pass: failures.length === 0, failures };
}
