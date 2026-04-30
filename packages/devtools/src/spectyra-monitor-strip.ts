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
  private _timer?: number;
  private _polling = false;
  /** Both summary routes 404 — dev bridge not mounted; poll rarely. */
  private _slow = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._polling = true;
    const tick = async (): Promise<void> => {
      if (!this._polling) return;
      await this._pull();
      if (!this._polling) return;
      const fast = Math.max(1500, this.pollIntervalMs);
      this._timer = window.setTimeout(() => void tick(), this._slow ? 60_000 : fast);
    };
    void tick();
  }

  disconnectedCallback(): void {
    this._polling = false;
    if (this._timer !== undefined) clearTimeout(this._timer);
    super.disconnectedCallback();
  }

  private async _pull(): Promise<void> {
    const root = (this.baseUrl ?? "").replace(/\/$/, "");
    if (!root) {
      this._err = "no_base_url";
      this._summary = null;
      this._slow = true;
      this.requestUpdate();
      return;
    }
    const paths = [`${root}/__spectyra/summary`, `${root}/__spectyra/monitor/summary`];
    let summary404s = 0;
    for (const path of paths) {
      try {
        const r = await fetch(path, { credentials: "same-origin" });
        if (r.ok) {
          this._summary = (await r.json()) as SpectyraMonitorSummary;
          this._err = null;
          this._slow = false;
          this.requestUpdate();
          return;
        }
        if (r.status === 404) summary404s += 1;
      } catch {
        this._err = "unreachable";
        this._summary = null;
      }
    }
    if (summary404s >= 2) {
      this._slow = true;
      this._err = "bridge_off";
      this._summary = null;
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
