export interface SettingsPanelDescriptor {
  kind: "spectyra.settings_panel";
  optimizationEnabled: boolean;
  securityWarningsEnabled: boolean;
}

export function buildSettingsPanelDescriptor(input: {
  optimizationEnabled: boolean;
  securityWarningsEnabled: boolean;
}): SettingsPanelDescriptor {
  return {
    kind: "spectyra.settings_panel",
    optimizationEnabled: input.optimizationEnabled,
    securityWarningsEnabled: input.securityWarningsEnabled,
  };
}
