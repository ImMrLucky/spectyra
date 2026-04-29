import { LitElement, html, css } from "lit";
import type { SpectyraMonitorSummary } from "@spectyra/sdk";

/**
 * Compact monitor rollup chip; polls the Phase 6 dev bridge (`/__spectyra/monitor/summary`).
 */
export class SpectyraMonitorStrip extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      font: 12px/1.35 ui-sans-serif, system-ui, Segoe UI, Roboto, sans-serif;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 8px;
      background: #0f172a;
      color: #e2e8f0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }
    .muted {
      color: #94a3b8;
      font-size: 11px;
    }
    .err {
      color: #fca5a5;
      font-size: 11px;
    }
  `;

  static properties = {
    baseUrl: { type: String, attribute: "base-url" },
    pollIntervalMs: { type: Number, attribute: "poll-interval-ms" },
  };

  baseUrl = "";
  pollIntervalMs = 3000;

  private _summary: SpectyraMonitorSummary | null = null;
  private _err: string | null = null;
  private _timer: ReturnType<typeof setInterval> | undefined;

  connectedCallback(): void {
    super.connectedCallback();
    void this._pull();
    this._timer = setInterval(() => void this._pull(), Math.max(1500, this.pollIntervalMs));
  }

  disconnectedCallback(): void {
    if (this._timer) clearInterval(this._timer);
    super.disconnectedCallback();
  }

  private async _pull(): Promise<void> {
    const root = (this.baseUrl ?? "").replace(/\/$/, "");
    const paths = [`${root}/__spectyra/summary`, `${root}/__spectyra/monitor/summary`];
    for (const path of paths) {
      try {
        const r = await fetch(path, { credentials: "same-origin" });
        if (!r.ok) continue;
        this._summary = (await r.json()) as SpectyraMonitorSummary;
        this._err = null;
        this.requestUpdate();
        return;
      } catch {
        this._err = "unreachable";
        this._summary = null;
      }
    }
    this.requestUpdate();
  }

  protected render() {
    if (this._err && !this._summary) {
      return html`<div class="bar"><span class="err">Monitor: bridge ${this._err}</span></div>`;
    }
    const s = this._summary;
    if (!s) {
      return html`<div class="bar"><span class="muted">Monitor…</span></div>`;
    }
    return html`<div class="bar">
      <strong>Spectyra</strong>
      <span>${s.requestCount} reqs</span>
      <span class="muted">Spend $${s.actualSpendProviderUsd.toFixed(2)}</span>
    </div>`;
  }
}
