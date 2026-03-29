import { Injectable } from '@angular/core';
import { CompanionAnalyticsService } from '../analytics/companion-analytics.service';
import { DesktopBridgeService } from '../desktop/desktop-bridge.service';

export type RuntimeType =
  | 'openclaw'
  | 'claude'
  | 'openai'
  | 'sdk'
  | 'generic-endpoint'
  | 'logs-traces';

export type ConnectionStyle = 'launch' | 'attach' | 'observe';
export type SetupPath = 'new' | 'existing';

export type WizardStep =
  | 'select-runtime'
  | 'select-path'
  | 'select-connection'
  | 'configure'
  | 'validate'
  | 'go-live';

export interface ValidationCheck {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'skip';
  detail?: string;
}

export interface RuntimeOption {
  type: RuntimeType;
  label: string;
  description: string;
  icon: string;
  connectionStyles: ConnectionStyle[];
  adapterKind: string;
}

export interface AgentCompanionState {
  step: WizardStep;
  runtime: RuntimeType | null;
  setupPath: SetupPath | null;
  connectionStyle: ConnectionStyle | null;
  checks: ValidationCheck[];
  companionHealthy: boolean;
  companionOrigin: string;
}

export const RUNTIME_OPTIONS: RuntimeOption[] = [
  {
    type: 'openclaw',
    label: 'OpenClaw',
    description: 'Local CLI agent with custom provider support. Point OpenClaw at the Spectyra companion on localhost.',
    icon: 'terminal',
    connectionStyles: ['launch', 'attach', 'observe'],
    adapterKind: 'spectyra.openclaw.jsonl.v1',
  },
  {
    type: 'claude',
    label: 'Claude Runtime',
    description: 'Claude Code, Claude hooks, or MCP-based Claude agents. Attach via hooks or JSONL log tailing.',
    icon: 'psychology',
    connectionStyles: ['attach', 'observe'],
    adapterKind: 'spectyra.claude-hooks.v1',
  },
  {
    type: 'openai',
    label: 'OpenAI Agents',
    description: 'OpenAI Agents SDK with tracing. Attach via tracing spans or custom provider endpoint.',
    icon: 'hub',
    connectionStyles: ['attach', 'observe'],
    adapterKind: 'spectyra.openai-tracing.v1',
  },
  {
    type: 'sdk',
    label: 'SDK App',
    description: 'Wrap LLM calls in your own codebase with @spectyra/sdk. Best fidelity and control.',
    icon: 'code',
    connectionStyles: ['launch', 'attach'],
    adapterKind: 'spectyra.sdk.v1',
  },
  {
    type: 'generic-endpoint',
    label: 'Generic Endpoint',
    description: 'Any OpenAI-compatible or Anthropic-compatible local endpoint. Configure base URL and model mapping.',
    icon: 'dns',
    connectionStyles: ['launch', 'attach', 'observe'],
    adapterKind: 'spectyra.companion.v1',
  },
  {
    type: 'logs-traces',
    label: 'Logs / Traces / JSONL',
    description: 'Tail log files, JSONL traces, or structured events. Analytics-first with optional optimization.',
    icon: 'description',
    connectionStyles: ['attach', 'observe'],
    adapterKind: 'spectyra.generic-jsonl.v1',
  },
];

const CONNECTION_LABELS: Record<ConnectionStyle, { label: string; description: string }> = {
  launch: {
    label: 'Launch',
    description: 'Start the companion and route traffic through it. Full optimization + monitoring.',
  },
  attach: {
    label: 'Attach',
    description: 'Connect to an already-running agent. Monitor and optimize in-flight.',
  },
  observe: {
    label: 'Observe only',
    description: 'Watch traffic without modifying prompts. Projected savings, full monitoring.',
  },
};

@Injectable({ providedIn: 'root' })
export class AgentCompanionService {
  state: AgentCompanionState = {
    step: 'select-runtime',
    runtime: null,
    setupPath: null,
    connectionStyle: null,
    checks: [],
    companionHealthy: false,
    companionOrigin: '',
  };

  get runtimeOptions(): RuntimeOption[] {
    return RUNTIME_OPTIONS;
  }

  connectionLabel(style: ConnectionStyle) {
    return CONNECTION_LABELS[style];
  }

  selectedRuntime(): RuntimeOption | null {
    if (!this.state.runtime) return null;
    return RUNTIME_OPTIONS.find((r) => r.type === this.state.runtime) ?? null;
  }

  selectRuntime(type: RuntimeType): void {
    this.state.runtime = type;
    this.state.step = 'select-path';
  }

  selectPath(path: SetupPath): void {
    this.state.setupPath = path;
    this.state.step = 'select-connection';
  }

  selectConnection(style: ConnectionStyle): void {
    this.state.connectionStyle = style;
    this.state.step = 'validate';
    void this.runValidation();
  }

  goToStep(step: WizardStep): void {
    this.state.step = step;
  }

  reset(): void {
    this.state = {
      step: 'select-runtime',
      runtime: null,
      setupPath: null,
      connectionStyle: null,
      checks: [],
      companionHealthy: false,
      companionOrigin: '',
    };
  }

  constructor(
    private companion: CompanionAnalyticsService,
    private bridge: DesktopBridgeService,
  ) {}

  async runValidation(): Promise<void> {
    this.state.checks = [
      { id: 'companion', label: 'Local Companion reachable', status: 'checking' },
      { id: 'models', label: 'Models endpoint responds', status: 'pending' },
      { id: 'provider', label: 'Provider key configured', status: 'pending' },
      { id: 'telemetry', label: 'Telemetry enabled', status: 'pending' },
    ];

    const origin = await this.companion.resolveCompanionOrigin();
    this.state.companionOrigin = origin;

    try {
      const health = await this.companion.fetchHealth();
      if (health && health['status'] === 'ok') {
        this.state.companionHealthy = true;
        this.updateCheck('companion', 'pass', `Connected at ${origin}`);

        const providerKey = health['licenseKeyPresent'] || health['providerConfigured'];
        this.updateCheck('provider', providerKey ? 'pass' : 'fail',
          providerKey ? 'Provider key set' : 'No provider key — configure in Settings');

        const telemetry = String(health['telemetryMode'] ?? 'off');
        this.updateCheck('telemetry', telemetry !== 'off' ? 'pass' : 'fail',
          telemetry !== 'off' ? `Telemetry: ${telemetry}` : 'Telemetry is off — enable in Settings');
      } else {
        this.state.companionHealthy = false;
        this.updateCheck('companion', 'fail', 'Companion not responding');
        this.updateCheck('provider', 'skip');
        this.updateCheck('telemetry', 'skip');
      }
    } catch {
      this.state.companionHealthy = false;
      this.updateCheck('companion', 'fail', `Cannot reach ${origin}`);
      this.updateCheck('provider', 'skip');
      this.updateCheck('telemetry', 'skip');
    }

    if (this.state.companionHealthy) {
      this.updateCheck('models', 'checking');
      try {
        const r = await fetch(`${origin}/v1/models`);
        if (r.ok) {
          const data = await r.json();
          const ids = (data?.data || []).map((m: { id: string }) => m.id).join(', ');
          this.updateCheck('models', 'pass', ids || 'Models available');
        } else {
          this.updateCheck('models', 'fail', `Status ${r.status}`);
        }
      } catch {
        this.updateCheck('models', 'fail', 'Cannot reach models endpoint');
      }
    } else {
      this.updateCheck('models', 'skip');
    }
  }

  private updateCheck(id: string, status: ValidationCheck['status'], detail?: string): void {
    const c = this.state.checks.find((x) => x.id === id);
    if (c) {
      c.status = status;
      if (detail !== undefined) c.detail = detail;
    }
  }

  allChecksPassed(): boolean {
    return this.state.checks.every((c) => c.status === 'pass' || c.status === 'skip');
  }

  criticalChecksPassed(): boolean {
    const companion = this.state.checks.find((c) => c.id === 'companion');
    return companion?.status === 'pass';
  }
}
