import type { CommandContext } from "../commands/spectyra-commands.js";
import {
  runSpectyraDisable,
  runSpectyraEnable,
  runSpectyraOpenDashboard,
  runSpectyraStatus,
  SPECTYRA_COMMAND_IDS,
} from "../commands/spectyra-commands.js";
import { openClawLatestOkToView, SPECTYRA_COMPANION_BASE } from "../companion/companion-client.js";
import { LatestSavingsCoordinator } from "../companion/latest-savings-coordinator.js";
import { beforeMessageSend, runBeforeMessageSendHook } from "../hooks/message-hooks.js";
import { afterAssistantResponse } from "../hooks/response-hooks.js";
import { evaluateToolCall } from "../hooks/tool-hooks.js";
import { buildToolRiskEventPayload } from "../security/prompt-security-scanner.js";
import { buildFlowSummaryDescriptor, formatFlowSummarySpectyraBlock, resolveFlowSummary } from "../ui/spectyra-flow-summary.js";
import { buildStatusPanelDescriptor, formatSpectyraStatusMarkdown } from "../ui/spectyra-status-panel.js";
import { formatSavingsBadgeLabel } from "../ui/spectyra-savings-badge.js";
import { shouldShowNonBlockingSecurityNotice } from "../ui/spectyra-security-alert.js";
import type { MessageHookDeps } from "../hooks/message-hooks.js";
import { SafeLogger } from "../utils/safe-logger.js";
import type { OpenClawAdapterResult } from "./openclaw-types.js";

const log = new SafeLogger("spectyra-openclaw-adapter");

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickOpenExternal(api: Record<string, unknown>): CommandContext["openExternal"] {
  const shell = api.shell;
  if (isRecord(shell) && typeof shell.openExternal === "function") {
    return (url: string) => void (shell.openExternal as (u: string) => void)(url);
  }
  const workspace = api.workspace;
  if (isRecord(workspace) && typeof workspace.openExternal === "function") {
    return (url: string) => void (workspace.openExternal as (u: string) => void)(url);
  }
  const env = api.env;
  if (isRecord(env) && typeof env.openExternal === "function") {
    return (url: string) => void (env.openExternal as (u: string) => void)(url);
  }
  return undefined;
}

function pickShowMessage(api: Record<string, unknown>): CommandContext["showMessage"] {
  const ui = api.ui;
  if (isRecord(ui) && typeof ui.showInformationMessage === "function") {
    return (text: string) => void (ui.showInformationMessage as (t: string) => void)(text);
  }
  if (typeof api.showMessage === "function") {
    return (text: string) => void (api.showMessage as (t: string) => void)(text);
  }
  return undefined;
}

function pickShowNonBlockingNotice(api: Record<string, unknown>): MessageHookDeps["showNonBlockingNotice"] {
  const ui = api.ui ?? api;
  if (!isRecord(ui)) {
    return undefined;
  }
  if (typeof ui.showNonBlockingNotice === "function") {
    return (input: { title: string; markdown: string }) =>
      void (ui.showNonBlockingNotice as (x: { title: string; markdown: string }) => void)(input);
  }
  if (typeof ui.showInformationMessage === "function") {
    return (input: { title: string; markdown: string }) =>
      void (ui.showInformationMessage as (t: string) => void)(`${input.title}\n\n${input.markdown}`);
  }
  return undefined;
}

function tryRegisterCommand(
  host: Record<string, unknown>,
  id: string,
  run: () => void | Promise<void>,
  disposers: Array<() => void>,
): void {
  const reg = host.commands ?? host.commandRegistry ?? host.palette;
  if (!isRecord(reg)) {
    return;
  }
  if (typeof reg.register === "function") {
    const out = (reg.register as (a: string, b: () => void | Promise<void>) => unknown)(id, run);
    if (typeof out === "function") {
      disposers.push(out as () => void);
    }
    log.info("Registered command", { id, path: "register" });
    return;
  }
  if (typeof reg.add === "function") {
    void (reg.add as (c: { id: string; handler: () => void | Promise<void> }) => unknown)({ id, handler: run });
    log.info("Registered command", { id, path: "add" });
  }
}

function tryHook(
  host: Record<string, unknown>,
  eventName: string,
  handler: (...args: unknown[]) => void | Promise<void>,
  disposers: Array<() => void>,
): void {
  const hooks = host.hooks ?? host;
  if (!isRecord(hooks)) {
    return;
  }
  if (typeof hooks.addListener === "function") {
    const unsub = (hooks.addListener as (ev: string, h: typeof handler) => void | (() => void))(
      eventName,
      handler,
    );
    if (typeof unsub === "function") {
      disposers.push(unsub);
    }
    log.info("Hook attached", { eventName, path: "addListener" });
    return;
  }
  const fn = hooks[eventName] as unknown;
  if (typeof fn === "function") {
    void (fn as (h: typeof handler) => void)(handler);
    log.info("Hook attached", { eventName, path: "direct" });
  }
}

function tryDecorateAssistant(
  host: Record<string, unknown>,
  deps: CommandContext,
  disposers: Array<() => void>,
  coordinator: LatestSavingsCoordinator,
): void {
  const ui = host.ui ?? host.chat ?? host.surface;
  if (!isRecord(ui)) {
    return;
  }
  const decorate =
    (ui.decorateAssistantMessage as
      | ((cb: (msg: unknown, ctx: Record<string, unknown>) => Promise<unknown> | unknown) => () => void)
      | undefined) ??
    (ui.attachAssistantDecoration as typeof ui.decorateAssistantMessage) ??
    (ui.addMessageDecoration as typeof ui.decorateAssistantMessage);
  if (typeof decorate !== "function") {
    return;
  }
  const unsub = decorate(async (_msg: unknown, ctx: Record<string, unknown>) => {
    return afterAssistantResponse(ctx, {
      companion: deps.companion,
      optimizationEnabled: deps.getOptimizationEnabled,
      seamless: {
        getFreshLatest: () => coordinator.getFreshLatest(),
        alreadyShownInline: (id) => coordinator.alreadyShownInline(id),
      },
      onInlineSavingsShown: (id) => coordinator.rememberInline(id),
    });
  });
  if (typeof unsub === "function") {
    disposers.push(unsub);
  }
  log.info("Assistant decoration registered", {});
}

function tryFlowSummary(host: Record<string, unknown>, deps: CommandContext, disposers: Array<() => void>): void {
  const ui = host.ui ?? host.agent;
  if (!isRecord(ui)) {
    return;
  }
  const reg =
    (ui.onFlowComplete as
      | ((cb: (flow: Record<string, unknown>) => Promise<unknown> | unknown) => () => void)
      | undefined) ?? (ui.afterAgentRun as typeof ui.onFlowComplete);
  if (typeof reg !== "function") {
    return;
  }
  const unsub = reg(async (flow: Record<string, unknown>) => {
    const fid = typeof flow.flowId === "string" ? flow.flowId : typeof flow.id === "string" ? flow.id : undefined;
    const summary = await resolveFlowSummary(deps.companion, fid);
    return summary ? buildFlowSummaryDescriptor(summary) : null;
  });
  if (typeof unsub === "function") {
    disposers.push(unsub);
  }
  log.info("Flow summary hook registered", {});
}

function tryComposerWarning(host: Record<string, unknown>, deps: CommandContext, disposers: Array<() => void>): void {
  const ui = host.ui ?? host.composer;
  if (!isRecord(ui)) {
    return;
  }
  const hook =
    (ui.beforeComposerSend as
      | ((cb: (p: { text: string; messageId?: string; flowId?: string }) => unknown) => () => void)
      | undefined) ?? (ui.onBeforeSend as typeof ui.beforeComposerSend);
  if (typeof hook !== "function") {
    return;
  }
  const unsub = hook((payload: { text: string; messageId?: string; flowId?: string }) => {
    void Promise.resolve()
      .then(() => {
        try {
          if (!deps.getSecurityWarningsEnabled()) {
            return;
          }
          beforeMessageSend(
            { text: payload.text, messageId: payload.messageId, flowId: payload.flowId },
            {
              companion: deps.companion,
              securityWarningsEnabled: deps.getSecurityWarningsEnabled,
              showNonBlockingNotice: pickShowNonBlockingNotice(host),
            },
          );
        } catch (e) {
          log.warn("Spectyra composer security hook failed safely", {
            errorClass: e instanceof Error ? e.name : "unknown",
          });
        }
      })
      .catch(() => undefined);
    return undefined;
  });
  if (typeof unsub === "function") {
    disposers.push(unsub);
  }
  log.info("Composer warning hook registered", {});
}

function tryToolHook(host: Record<string, unknown>, deps: CommandContext, disposers: Array<() => void>): void {
  const tools = host.tools ?? host.ui;
  if (!isRecord(tools)) {
    return;
  }
  const hook = tools.beforeToolCall as ((cb: (name: string, args: unknown) => unknown) => () => void) | undefined;
  if (typeof hook !== "function") {
    return;
  }
  const unsub = hook((name: string, args: unknown) => {
    void Promise.resolve()
      .then(() => {
        try {
          const preview = typeof args === "string" ? args : JSON.stringify(args).slice(0, 400);
          const desc = evaluateToolCall(name, preview);
          if (desc) {
            deps.companion.postEvent(buildToolRiskEventPayload({ toolName: name, level: desc.level }));
            if (shouldShowNonBlockingSecurityNotice(desc.level)) {
              pickShowNonBlockingNotice(host)?.({
                title: "Spectyra — tool (advisory)",
                markdown: desc.markdown,
              });
            }
          }
        } catch (e) {
          log.warn("Spectyra tool risk scan failed safely", {
            errorClass: e instanceof Error ? e.name : "unknown",
          });
        }
      })
      .catch(() => undefined);
    return undefined;
  });
  if (typeof unsub === "function") {
    disposers.push(unsub);
  }
  log.info("Tool warning hook registered", {});
}

function trySidePanel(host: Record<string, unknown>, deps: CommandContext, coordinator: LatestSavingsCoordinator): void {
  const views = host.views ?? host.workspace ?? host.ui;
  if (!isRecord(views)) {
    return;
  }
  const reg = views.registerWebviewPanel ?? views.registerSidePanel;
  if (typeof reg !== "function") {
    return;
  }
  void reg({
    id: "spectyra.status",
    title: "Spectyra",
    resolve: async () => {
      const state = await deps.companion.connectionState();
      const desc = buildStatusPanelDescriptor({
        state,
        optimizationEnabled: deps.getOptimizationEnabled(),
        securityWarningsEnabled: deps.getSecurityWarningsEnabled(),
        companionBase: SPECTYRA_COMPANION_BASE,
      });
      const fresh = coordinator.getFreshLatest();
      const latestLine = fresh ? formatSavingsBadgeLabel(openClawLatestOkToView(fresh)) : null;
      const flow = await resolveFlowSummary(deps.companion, undefined);
      const flowMd = flow ? formatFlowSummarySpectyraBlock(flow) : null;
      return {
        markdown: formatSpectyraStatusMarkdown(desc, {
          latestSavingsLine: latestLine,
          flowSummaryMarkdown: flowMd,
        }),
      };
    },
  });
  log.info("Side panel registration attempted", {});
}

export function createOpenClawAdapter(api: unknown, deps: CommandContext): OpenClawAdapterResult {
  const disposers: Array<() => void> = [];
  if (!isRecord(api)) {
    log.warn("OpenClaw API missing or not an object — no host bindings", {});
    return {
      dispose() {
        while (disposers.length) {
          (disposers.pop() as () => void)();
        }
      },
    };
  }

  const cmdCtx: CommandContext = {
    ...deps,
    openExternal: deps.openExternal ?? pickOpenExternal(api),
    showMessage: deps.showMessage ?? pickShowMessage(api),
  };

  const coordinator = new LatestSavingsCoordinator(cmdCtx.companion);
  coordinator.start();
  disposers.push(() => coordinator.stop());

  tryRegisterCommand(api, SPECTYRA_COMMAND_IDS[0], () => void runSpectyraStatus(cmdCtx), disposers);
  tryRegisterCommand(api, SPECTYRA_COMMAND_IDS[1], () => void runSpectyraEnable(cmdCtx), disposers);
  tryRegisterCommand(api, SPECTYRA_COMMAND_IDS[2], () => void runSpectyraDisable(cmdCtx), disposers);
  tryRegisterCommand(api, SPECTYRA_COMMAND_IDS[3], () => void runSpectyraOpenDashboard(cmdCtx), disposers);

  tryHook(
    api,
    "beforeMessageSend",
    (payload: unknown) => {
      void (async () => {
        try {
          const ctx = isRecord(payload) ? payload : {};
          runBeforeMessageSendHook(ctx, {
            companion: cmdCtx.companion,
            securityWarningsEnabled: cmdCtx.getSecurityWarningsEnabled,
            showNonBlockingNotice: pickShowNonBlockingNotice(api),
          });
        } catch (e) {
          log.warn("Spectyra beforeMessageSend failed safely", {
            errorClass: e instanceof Error ? e.name : "unknown",
          });
        }
      })();
    },
    disposers,
  );

  tryDecorateAssistant(api, cmdCtx, disposers, coordinator);
  tryFlowSummary(api, cmdCtx, disposers);
  tryComposerWarning(api, cmdCtx, disposers);
  tryToolHook(api, cmdCtx, disposers);
  trySidePanel(api, cmdCtx, coordinator);

  return {
    dispose() {
      while (disposers.length) {
        const d = disposers.pop();
        try {
          d?.();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
