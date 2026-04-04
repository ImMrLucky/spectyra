import { Injectable, inject, signal, computed } from '@angular/core';
import { DesktopBridgeService } from './desktop-bridge.service';
import type { AssistantProfile, TaskTemplate } from '../../../spectyra-window';

export interface OpenClawStatusSnapshot {
  cliDetected: boolean;
  companionRunning: boolean;
  companionHealthy: boolean;
  providerConfigured: boolean;
  dashboardReachable: boolean;
  gatewayReachable: boolean;
  runMode?: string;
  provider?: string;
  modelAliases?: string[];
  openclawDetected: boolean;
  openclawConnected: boolean;
}

export interface SkillSearchResult {
  name: string;
  description: string;
  raw: string;
}

export interface InstalledSkill {
  name: string;
  version: string;
  raw: string;
}

const DEFAULT_PROFILES: AssistantProfile[] = [
  {
    id: 'preset-ai-assistant',
    name: 'AI Assistant',
    role: 'General-purpose AI assistant',
    systemPrompt: 'You are a helpful, accurate, and friendly AI assistant. Answer questions clearly and concisely. When unsure, say so. Prioritize correctness over speed.',
    skills: ['web-search', 'file-manager', 'calculator'],
    notes: 'Good for everyday tasks, research, writing, and brainstorming.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset-ai-coder',
    name: 'AI Coder',
    role: 'Software engineering assistant',
    systemPrompt: 'You are an expert software engineer. Write clean, well-tested code. Follow best practices for the language and framework in use. Explain your reasoning when making architectural decisions. Prefer simple solutions.',
    skills: ['code-review', 'test-runner', 'git-tools', 'file-manager'],
    notes: 'Best for coding tasks, debugging, refactoring, and code review.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset-researcher',
    name: 'Research Assistant',
    role: 'Deep research and analysis',
    systemPrompt: 'You are a thorough research assistant. When given a topic, explore it deeply. Cite sources when possible. Present findings in a structured format with key takeaways. Distinguish facts from opinions.',
    skills: ['web-search', 'file-manager'],
    notes: 'Ideal for market research, competitive analysis, literature reviews, and fact-checking.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_TASKS: TaskTemplate[] = [
  {
    id: 'preset-daily-briefing',
    name: 'Daily Briefing',
    type: 'daily',
    schedule: '0 9 * * *',
    prompt: 'Summarize the most important updates from the past 24 hours. Include any pending items that need attention today.',
    notes: 'Runs every morning at 9 AM. Customize the prompt to focus on your domain.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset-heartbeat',
    name: 'Health Check Heartbeat',
    type: 'heartbeat',
    schedule: '*/30 * * * *',
    prompt: 'Check the status of configured services and report any issues.',
    fileContent: '# HEARTBEAT.md\n\nRun a health check every 30 minutes.\n\n## Checks\n- Service availability\n- Error rate thresholds\n- Resource utilization\n',
    notes: 'Creates a HEARTBEAT.md in the workspace. Customize checks for your stack.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

@Injectable({ providedIn: 'root' })
export class OpenClawDesktopService {
  private readonly desktop = inject(DesktopBridgeService);

  readonly status = signal<OpenClawStatusSnapshot | null>(null);
  readonly loading = signal(false);
  readonly profiles = signal<AssistantProfile[]>([]);
  readonly tasks = signal<TaskTemplate[]>([]);
  readonly installedSkills = signal<InstalledSkill[]>([]);

  private get hub() {
    return typeof window !== 'undefined' ? window.spectyra?.openclawHub : undefined;
  }

  async refreshStatus(): Promise<OpenClawStatusSnapshot> {
    this.loading.set(true);
    try {
      const [cliResult, healthRaw, setupStatus, dashRes, gwRes] = await Promise.all([
        this.desktop.isElectronRenderer && window.spectyra?.openclaw?.detectCli
          ? window.spectyra.openclaw.detectCli()
          : Promise.resolve({ available: false }),
        this.desktop.companionHealth(),
        this.desktop.isElectronRenderer && window.spectyra?.companion?.getSetupStatus
          ? window.spectyra.companion.getSetupStatus()
          : Promise.resolve(null),
        this.hub?.dashboardCheck() ?? Promise.resolve({ reachable: false }),
        this.hub?.gatewayCheck() ?? Promise.resolve({ reachable: false }),
      ]);

      const companionRunning = !!healthRaw;
      const companionHealthy = healthRaw?.['status'] === 'ok';
      const providerConfigured = healthRaw?.['providerConfigured'] === true;
      const runMode = healthRaw?.['runMode'] as string | undefined;
      const provider = healthRaw?.['provider'] as string | undefined;

      let openclawDetected = false;
      let openclawConnected = false;
      if (setupStatus && 'fetchOk' in setupStatus && setupStatus.fetchOk && setupStatus.openclawJson) {
        openclawDetected = setupStatus.openclawJson.detected === true || cliResult.available;
        openclawConnected = setupStatus.openclawJson.connected === true;
      } else {
        openclawDetected = cliResult.available;
      }

      const snap: OpenClawStatusSnapshot = {
        cliDetected: cliResult.available,
        companionRunning,
        companionHealthy,
        providerConfigured,
        dashboardReachable: dashRes.reachable,
        gatewayReachable: gwRes.reachable,
        runMode,
        provider,
        modelAliases: ['spectyra/smart', 'spectyra/fast', 'spectyra/quality'],
        openclawDetected,
        openclawConnected,
      };
      this.status.set(snap);
      return snap;
    } finally {
      this.loading.set(false);
    }
  }

  async loadProfiles(): Promise<AssistantProfile[]> {
    if (!this.hub) {
      this.profiles.set(DEFAULT_PROFILES);
      return DEFAULT_PROFILES;
    }
    let list = await this.hub.profilesList();
    if (!list || list.length === 0) {
      list = DEFAULT_PROFILES;
      await this.hub.profilesSave(list);
    }
    this.profiles.set(list);
    return list;
  }

  async saveProfile(profile: AssistantProfile): Promise<void> {
    const current = [...this.profiles()];
    const idx = current.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      current[idx] = { ...profile, updatedAt: new Date().toISOString() };
    } else {
      current.push({ ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.profiles.set(current);
    await this.hub?.profilesSave(current);
  }

  async deleteProfile(id: string): Promise<void> {
    const current = this.profiles().filter((p) => p.id !== id);
    this.profiles.set(current);
    await this.hub?.profilesSave(current);
  }

  async loadTasks(): Promise<TaskTemplate[]> {
    if (!this.hub) {
      this.tasks.set(DEFAULT_TASKS);
      return DEFAULT_TASKS;
    }
    let list = await this.hub.tasksList();
    if (!list || list.length === 0) {
      list = DEFAULT_TASKS;
      await this.hub.tasksSave(list);
    }
    this.tasks.set(list);
    return list;
  }

  async saveTask(task: TaskTemplate): Promise<void> {
    const current = [...this.tasks()];
    const idx = current.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      current[idx] = { ...task, updatedAt: new Date().toISOString() };
    } else {
      current.push({ ...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.tasks.set(current);
    await this.hub?.tasksSave(current);
  }

  async deleteTask(id: string): Promise<void> {
    const current = this.tasks().filter((t) => t.id !== id);
    this.tasks.set(current);
    await this.hub?.tasksSave(current);
  }

  async searchSkills(query: string): Promise<SkillSearchResult[]> {
    if (!this.hub) return [];
    const r = await this.hub.skillsSearch(query);
    return r.ok ? r.results : [];
  }

  async loadInstalledSkills(): Promise<InstalledSkill[]> {
    if (!this.hub) return [];
    const r = await this.hub.skillsInstalled();
    if (r.ok) this.installedSkills.set(r.skills);
    return r.ok ? r.skills : [];
  }

  async installSkill(name: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.hub) return { ok: false, error: 'Not in desktop app' };
    const r = await this.hub.skillsInstall(name);
    if (r.ok) await this.loadInstalledSkills();
    return r;
  }

  async updateSkills(): Promise<{ ok: boolean; error?: string }> {
    if (!this.hub) return { ok: false, error: 'Not in desktop app' };
    const r = await this.hub.skillsUpdate();
    if (r.ok) await this.loadInstalledSkills();
    return r;
  }

  async runDoctor(): Promise<{ ok: boolean; output: string }> {
    if (!this.hub) return { ok: false, output: 'Not in desktop app' };
    return this.hub.doctor();
  }

  async openConfig(): Promise<void> {
    await this.hub?.openConfig();
  }

  async openLogs(): Promise<void> {
    await this.hub?.openLogs();
  }

  async restartCompanion(): Promise<void> {
    if (!window.spectyra?.companion) return;
    await window.spectyra.companion.stop();
    await window.spectyra.companion.start();
  }
}
