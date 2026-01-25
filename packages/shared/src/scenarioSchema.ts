export interface ScenarioTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RequiredCheck {
  name: string;
  type: "regex";
  pattern: string;
}

export interface Scenario {
  id: string;
  path: "talk" | "code";
  title: string;
  turns: ScenarioTurn[];
  required_checks: RequiredCheck[];
}
