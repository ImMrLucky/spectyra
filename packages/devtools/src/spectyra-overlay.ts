import { LitElement, html, css, nothing } from "lit";
import type { SpectyraMonitorEvent, SpectyraMonitorSummary } from "@spectyra/sdk";

type TabId = "overview" | "costs" | "waste" | "settings";

type WasteRollup = { byType: Record<string, number>; estimatedImpactUsd: number };

type OverlayQuotaCtx = {
  plan?: string;
  canRunOptimized?: boolean;
  freeOptimizerPercentUsed?: number | null;
  upgradeUrl?: string;
};

const LS_POS = "spectyra-overlay-pos";
const LS_TAB = "spectyra-overlay-tab";

/** When not using SSE, poll this often (ms) — keep high to avoid freezing the tab. */
const POLL_INTERVAL_MS = 4000;

function isLikelyDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
}

function readOverlayQuota(): OverlayQuotaCtx | null {
  try {
    const w = window as unknown as {
      __SPECTYRA_OVERLAY_CTX__?: OverlayQuotaCtx | (() => OverlayQuotaCtx | null | undefined);
    };
    const c = w.__SPECTYRA_OVERLAY_CTX__;
    if (typeof c === "function") return c() ?? null;
    return c ?? null;
  } catch {
    return null;
  }
}

function spend(ev: SpectyraMonitorEvent): number {
  return ev.actualCostUsd ?? ev.estimatedCostUsd ?? 0;
}

/**
 * Full floating cost monitor: prefers one {@link EventSource} to `/__spectyra/stream`
 * (default). Set `poll-only` to use slow HTTP polling instead (e.g. SSE blocked by proxy).
 * @public
 */
export class SpectyraOverlay extends LitElement {
  static styles = css`
    :host {
      display: block;
      z-index: 2147483000;
      font: 13px/1.45 ui-sans-serif, system-ui, Segoe UI, Roboto, sans-serif;
      --bg: #0b1220;
      --panel: #111827;
      --border: #1f2937;
      --text: #e5e7eb;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --warn: #fbbf24;
    }
    .pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      background: var(--panel);
      color: var(--text);
      border: 1px solid var(--border);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      user-select: none;
      max-width: min(420px, 92vw);
    }
    .pill:hover {
      border-color: #334155;
    }
    .panel {
      width: min(440px, 94vw);
      max-height: min(78vh, 640px);
      display: flex;
      flex-direction: column;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      cursor: grab;
      touch-action: none;
    }
    .head:active {
      cursor: grabbing;
    }
    .title {
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .icon-btn {
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 6px;
    }
    .icon-btn:hover {
      color: var(--text);
      background: #1f2937;
    }
    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--border);
      background: #0f172a;
    }
    .tab {
      flex: 1;
      padding: 10px 6px;
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 12px;
    }
    .tab[aria-selected="true"] {
      color: var(--text);
      border-bottom: 2px solid var(--accent);
    }
    .body {
      padding: 12px 14px 16px;
      overflow: auto;
      flex: 1;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .stat {
      padding: 10px;
      border-radius: 10px;
      background: #0f172a;
      border: 1px solid var(--border);
    }
    .stat .k {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .stat .v {
      font-size: 18px;
      font-weight: 600;
      margin-top: 4px;
    }
    .card {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #0f172a;
      margin-bottom: 10px;
    }
    .card h4 {
      margin: 0 0 4px;
      font-size: 13px;
    }
    .card p {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
    }
    .muted {
      color: var(--muted);
      font-size: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed #1f2937;
      font-size: 12px;
    }
    .hidden {
      display: none !important;
    }
    table.tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 8px;
    }
    table.tbl th,
    table.tbl td {
      text-align: left;
      padding: 6px 4px;
      border-bottom: 1px solid #1f2937;
    }
    table.tbl th {
      color: var(--muted);
      font-weight: 500;
    }
    a.cta {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    a.cta:hover {
      text-decoration: underline;
    }
  `;

  static properties = {
    baseUrl: { type: String, attribute: "base-url" },
    /** When set, use slow HTTP polling instead of one `EventSource` (e.g. SSE blocked by a proxy). */
    pollOnly: { type: Boolean, attribute: "poll-only" },
    forceVisible: { type: Boolean, attribute: "force-visible" },
    /** When set, sent as `Authorization: Bearer …` on fetches and `?token=` on SSE (matches dev bridge `token`). */
    bridgeToken: { type: String, attribute: "bridge-token" },
  };

  baseUrl = "";
  pollOnly = false;
  forceVisible = false;
  bridgeToken = "";

  private _collapsed = true;
  private _tab: TabId = "overview";
  private _summary: SpectyraMonitorSummary | null = null;
  private _waste: WasteRollup | null = null;
  private _events: SpectyraMonitorEvent[] = [];
  private _err: string | null = null;
  private _poll?: ReturnType<typeof setInterval>;
  private _es?: EventSource;
  private _x = 16;
  private _y = 16;
  private _drag: { dx: number; dy: number; active: boolean } | null = null;

  private _onWinPointerMove = (e: PointerEvent) => {
    if (!this._drag?.active) return;
    this._x = Math.max(8, Math.min(window.innerWidth - 80, e.clientX - this._drag.dx));
    this._y = Math.max(8, Math.min(window.innerHeight - 80, e.clientY - this._drag.dy));
    this._persistPos();
    this.requestUpdate();
  };

  private _onWinPointerUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", this._onWinPointerMove);
    if (this._drag?.active) {
      this._drag.active = false;
    }
    try {
      (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  private _fetchInit(): RequestInit {
    const init: RequestInit = { credentials: "same-origin" };
    if (this.bridgeToken) {
      init.headers = { Authorization: `Bearer ${this.bridgeToken}` };
    }
    return init;
  }

  private _streamUrl(root: string): string {
    const u = `${root}/__spectyra/stream`;
    if (!this.bridgeToken) return u;
    const sep = u.includes("?") ? "&" : "?";
    return `${u}${sep}token=${encodeURIComponent(this.bridgeToken)}`;
  }

  private _preferEventSource(): boolean {
    return !this.pollOnly && typeof EventSource !== "undefined";
  }

  private _openEventSource(): void {
    const root = this._root();
    try {
      this._es = new EventSource(this._streamUrl(root));
      this._es.onopen = () => {
        this._err = null;
        this.requestUpdate();
      };
      this._es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data) as {
            summary?: SpectyraMonitorSummary;
            waste?: WasteRollup;
            eventTail?: SpectyraMonitorEvent[];
          };
          if (d.summary) this._summary = d.summary;
          if (d.waste) this._waste = d.waste;
          if (d.eventTail) this._events = d.eventTail;
          this.requestUpdate();
        } catch {
          /* ignore */
        }
      };
      this._es.onerror = () => {
        this._err = "stream_unavailable";
        this.requestUpdate();
      };
    } catch {
      this._startPollingTransport();
    }
  }

  /** Slow HTTP polling (summary + waste + events). */
  private _startPollingTransport(): void {
    if (this._poll) return;
    void this._pull();
    this._poll = setInterval(() => void this._pull(), POLL_INTERVAL_MS);
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.forceVisible && !isLikelyDevHost()) {
      this.classList.add("hidden");
      return;
    }
    try {
      const raw = localStorage.getItem(LS_POS);
      if (raw) {
        const p = JSON.parse(raw) as { x: number; y: number };
        this._x = p.x;
        this._y = p.y;
      }
      const t = localStorage.getItem(LS_TAB) as TabId | null;
      if (t && ["overview", "costs", "waste", "settings"].includes(t)) this._tab = t;
    } catch {
      /* ignore */
    }
    if (this._preferEventSource()) {
      this._openEventSource();
    } else {
      this._startPollingTransport();
    }
  }

  disconnectedCallback(): void {
    if (this._poll) clearInterval(this._poll);
    this._es?.close();
    window.removeEventListener("pointermove", this._onWinPointerMove);
    window.removeEventListener("pointerup", this._onWinPointerUp);
    super.disconnectedCallback();
  }

  private _root(): string {
    return (this.baseUrl ?? "").replace(/\/$/, "");
  }

  private async _pull(): Promise<void> {
    const root = this._root();
    let hit = false;
    for (const path of [`${root}/__spectyra/summary`, `${root}/__spectyra/monitor/summary`]) {
      try {
        const r = await fetch(path, this._fetchInit());
        if (!r.ok) continue;
        this._summary = (await r.json()) as SpectyraMonitorSummary;
        this._err = null;
        hit = true;
        break;
      } catch {
        this._err = "unreachable";
      }
    }
    if (!hit && !this._summary) {
      this._err = this._err ?? "unreachable";
    }
    try {
      const r = await fetch(`${this._root()}/__spectyra/waste`, this._fetchInit());
      if (r.ok) {
        const j = (await r.json()) as { waste: WasteRollup };
        this._waste = j.waste ?? null;
      }
    } catch {
      /* ignore */
    }
    try {
      let evHit = false;
      for (const path of [`${root}/__spectyra/events?limit=200`, `${root}/__spectyra/monitor/events?limit=200`]) {
        const r = await fetch(path, this._fetchInit());
        if (!r.ok) continue;
        const arr = (await r.json()) as SpectyraMonitorEvent[];
        if (Array.isArray(arr)) {
          this._events = arr;
          evHit = true;
          break;
        }
      }
      if (!evHit) this._events = [];
    } catch {
      this._events = [];
    }
    this.requestUpdate();
  }

  private _persistPos(): void {
    try {
      localStorage.setItem(LS_POS, JSON.stringify({ x: this._x, y: this._y }));
    } catch {
      /* ignore */
    }
  }

  private _onHeadPointerDown(e: PointerEvent): void {
    if (this._collapsed) return;
    this._drag = { dx: e.clientX - this._x, dy: e.clientY - this._y, active: true };
    window.addEventListener("pointermove", this._onWinPointerMove);
    window.addEventListener("pointerup", this._onWinPointerUp, { once: true });
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    e.preventDefault();
  }

  private _setTab(t: TabId): void {
    this._tab = t;
    try {
      localStorage.setItem(LS_TAB, t);
    } catch {
      /* ignore */
    }
    this.requestUpdate();
  }

  private _breakdowns() {
    const byProv = new Map<string, { spend: number; n: number }>();
    const byModel = new Map<string, { spend: number; n: number }>();
    for (const ev of this._events) {
      const p = ev.provider || "unknown";
      const m = `${ev.provider}:${ev.model ?? "?"}`;
      const s = spend(ev);
      const a = byProv.get(p) ?? { spend: 0, n: 0 };
      a.spend += s;
      a.n += 1;
      byProv.set(p, a);
      const b = byModel.get(m) ?? { spend: 0, n: 0 };
      b.spend += s;
      b.n += 1;
      byModel.set(m, b);
    }
    const topProv = [...byProv.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, 8);
    const topModel = [...byModel.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, 8);
    const costly = [...this._events].sort((a, b) => spend(b) - spend(a)).slice(0, 8);
    return { topProv, topModel, costly };
  }

  protected render() {
    if (this.classList.contains("hidden")) return nothing;

    const s = this._summary;
    const actual = s?.actualSpendProviderUsd ?? 0;
    const opt = s?.optimizedSpendSpectyraUsd ?? 0;
    const missed = s?.missedSavingsUsd ?? 0;
    const savings = s?.savingsUsd ?? 0;
    const optimizerOn = (s?.savingsUsd ?? 0) > 0.0001 || (s?.optimizedSpendSpectyraUsd ?? 0) > 0.0001;
    const q = readOverlayQuota();
    const pct = q?.freeOptimizerPercentUsed;
    const canOpt = q?.canRunOptimized !== false;
    const { topProv, topModel, costly } = this._breakdowns();
    const projected = actual * 30;

    const pillText = optimizerOn
      ? html`Spectyra <span class="muted">$${actual.toFixed(2)} today</span>
          <span style="color:#4ade80">↑ $${savings.toFixed(2)} saved</span>`
      : html`Spectyra <span class="muted">$${actual.toFixed(2)} today</span>
          <span style="color:var(--warn)">⚠ $${missed.toFixed(2)} missed</span>`;

    const panel = html`
      <div class="panel">
        <div class="head" @pointerdown=${this._onHeadPointerDown}>
          <div class="title">Spectyra Cost Monitor</div>
          <div>
            <button class="icon-btn" @click=${() => (this._collapsed = true)} aria-label="Minimize">─</button>
            <button class="icon-btn" @click=${() => this.remove()} aria-label="Close">×</button>
          </div>
        </div>
        <div class="tabs" role="tablist">
          ${(["overview", "costs", "waste", "settings"] as TabId[]).map(
            (t) => html`
              <button
                class="tab"
                role="tab"
                aria-selected=${this._tab === t}
                @click=${() => this._setTab(t)}
              >
                ${t[0]!.toUpperCase() + t.slice(1)}
              </button>
            `,
          )}
        </div>
        <div class="body">
          ${this._tab === "overview"
            ? html`
                <div class="muted" style="margin-bottom:10px">
                  Actual Spend (Provider): $${actual.toFixed(2)}<br />
                  ${optimizerOn
                    ? `Optimized Spend (Spectyra): $${opt.toFixed(2)}`
                    : `Potential Spend with Spectyra: $${(opt || actual * 0.85).toFixed(2)}`}<br />
                  ${optimizerOn ? `Savings: $${savings.toFixed(2)}` : `Missed Savings: $${missed.toFixed(2)}`}
                </div>
                <div class="grid">
                  <div class="stat"><div class="k">Requests</div><div class="v">${s?.requestCount ?? 0}</div></div>
                  <div class="stat"><div class="k">Avg latency</div><div class="v">${(s?.averageLatencyMs ?? 0).toFixed(0)} ms</div></div>
                  <div class="stat"><div class="k">Avg $ / req</div><div class="v">$${(s?.averageCostPerRequestUsd ?? 0).toFixed(4)}</div></div>
                  <div class="stat"><div class="k">Errors</div><div class="v">${s?.errorCount ?? 0}</div></div>
                </div>
                <p class="muted" style="margin-top:12px">
                  Projected ~30d (linear from session): ~$${projected.toFixed(2)}
                </p>
              `
            : nothing}
          ${this._tab === "costs"
            ? html`
                <p class="muted">From recent events (metadata only).</p>
                <h4 class="muted" style="margin:12px 0 4px">By provider</h4>
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Calls</th>
                      <th>$</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${topProv.length
                      ? topProv.map(
                          ([k, v]) => html`
                            <tr>
                              <td>${k}</td>
                              <td>${v.n}</td>
                              <td>$${v.spend.toFixed(4)}</td>
                            </tr>
                          `,
                        )
                      : html`<tr>
                          <td colspan="3">No events yet</td>
                        </tr>`}
                  </tbody>
                </table>
                <h4 class="muted" style="margin:12px 0 4px">By model</h4>
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Calls</th>
                      <th>$</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${topModel.length
                      ? topModel.map(
                          ([k, v]) => html`
                            <tr>
                              <td>${k}</td>
                              <td>${v.n}</td>
                              <td>$${v.spend.toFixed(4)}</td>
                            </tr>
                          `,
                        )
                      : html`<tr>
                          <td colspan="3">No events yet</td>
                        </tr>`}
                  </tbody>
                </table>
                <h4 class="muted" style="margin:12px 0 4px">Top spend calls</h4>
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Model</th>
                      <th>$</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${costly.length
                      ? costly.map(
                          (ev) => html`
                            <tr>
                              <td>${ev.provider}</td>
                              <td>${ev.model ?? "—"}</td>
                              <td>$${spend(ev).toFixed(4)}</td>
                            </tr>
                          `,
                        )
                      : html`<tr>
                          <td colspan="3">No events yet</td>
                        </tr>`}
                  </tbody>
                </table>
              `
            : nothing}
          ${this._tab === "waste"
            ? html`
                ${this._waste && Object.keys(this._waste.byType || {}).length
                  ? Object.entries(this._waste.byType || {}).map(
                      ([k, n]) => html`
                        <div class="card">
                          <h4>${k}</h4>
                          <p>${n} occurrence(s)</p>
                        </div>
                      `,
                    )
                  : html`<p class="muted">No waste summary yet.</p>`}
                <div class="card">
                  <h4>Signals</h4>
                  <p>
                    Estimated impact (aggregate):
                    $${(this._waste?.estimatedImpactUsd ?? 0).toFixed(2)}
                  </p>
                </div>
              `
            : nothing}
          ${this._tab === "settings"
            ? html`
                <div class="row"><span>Monitoring</span><span>on</span></div>
                <div class="row">
                  <span>Optimizer</span><span>${optimizerOn && canOpt ? "on" : "off / limited"}</span>
                </div>
                <div class="row"><span>Plan</span><span>${q?.plan ?? "—"}</span></div>
                <div class="row"><span>Bridge</span><span>${this._err ?? "ok"}</span></div>
                ${pct != null && pct < 100 && canOpt
                  ? html`<p class="muted" style="margin-top:12px">
                      You have used ${pct.toFixed(0)}% of your free optimization savings. Monitoring stays free.
                      ${q?.upgradeUrl
                        ? html` <a class="cta" href=${q.upgradeUrl} target="_blank" rel="noopener">Upgrade</a>`
                        : nothing}
                    </p>`
                  : nothing}
                ${!canOpt && (missed > 0 || !optimizerOn)
                  ? html`<p class="muted" style="margin-top:12px">
                      Optimization disabled. Monitoring continues. You missed an estimated $${missed.toFixed(
                        2,
                      )} in savings this session.
                      ${q?.upgradeUrl
                        ? html` <a class="cta" href=${q.upgradeUrl} target="_blank" rel="noopener">Upgrade</a>`
                        : nothing}
                    </p>`
                  : nothing}
                ${canOpt && pct == null
                  ? html`<p class="muted" style="margin-top:12px">
                      Set <code>window.__SPECTYRA_OVERLAY_CTX__</code> for quota-aware copy (plan, percent used,
                      upgrade URL).
                    </p>`
                  : nothing}
              `
            : nothing}
        </div>
      </div>
    `;

    return html`
      <div style="position:fixed;left:${this._x}px;bottom:24px;z-index:inherit;pointer-events:auto">
        ${this._collapsed
          ? html`<div
              class="pill"
              @click=${() => (this._collapsed = false)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  this._collapsed = false;
                }
              }}
              role="button"
              tabindex="0"
            >
              ${pillText}
            </div>`
          : panel}
      </div>
    `;
  }
}
