import type { SpectyraDevtoolsConfig, SpectyraConfig } from "../types.js";
import type { SpectyraEntitlementStatus } from "../observability/observabilityTypes.js";
import type { SpectyraSessionState } from "../observability/spectyraSessionState.js";
import { getPricingSnapshotMeta } from "../pricing/pricingRuntime.js";

function isBrowser(): boolean {
  if (typeof globalThis === "undefined") return false;
  return "document" in globalThis && typeof (globalThis as { document?: unknown }).document !== "undefined";
}

/** In browser: on unless `config.devtools?.enabled === false`. In Node: off. */
export function shouldMountDevtoolsByDefault(config: SpectyraConfig): boolean {
  if (!isBrowser()) return false;
  if (config.devtools?.enabled === false) return false;
  if (config.devtools?.enabled === true) return true;
  return true;
}

function posCss(p: string): string {
  switch (p) {
    case "bottom-left":
      return "left:10px;bottom:10px";
    case "top-right":
      return "right:10px;top:10px";
    case "top-left":
      return "left:10px;top:10px";
    case "bottom-right":
    default:
      return "right:10px;bottom:10px";
  }
}

export interface DevtoolsMountOptions {
  config: SpectyraConfig;
  devtools?: SpectyraDevtoolsConfig;
  getEntitlement: () => SpectyraEntitlementStatus | null;
  getSession: () => SpectyraSessionState;
  environmentLabel: string;
}

/**
 * Floating devtools: compact summary + optional expandable details. Browser + Shadow DOM only.
 */
export function mountSpectyraDevtools(opts: DevtoolsMountOptions): { unmount: () => void } {
  if (!isBrowser()) {
    return { unmount: () => {} };
  }
  const doc = (globalThis as { document: Document }).document;
  if (opts.devtools?.floatingPanel === false) {
    return { unmount: () => {} };
  }

  const position = opts.devtools?.position ?? "bottom-right";
  const defaultOpen = opts.devtools?.defaultOpen !== false;
  const rootId = "spectyra-sdk-devtools-root";
  if (doc.getElementById(rootId)) {
    return { unmount: () => {} };
  }

  const root = doc.createElement("div");
  root.id = rootId;
  root.setAttribute("data-spectyra", "devtools");
  doc.body.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  const pc = posCss(position);
  style.textContent = `*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif}
  .wrap{position:fixed;z-index:2147483000;${pc};display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:280px}
  .chip{display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:8px;background:#111;color:#e5e5e5;font-size:11px;box-shadow:0 2px 12px rgba(0,0,0,.25);cursor:pointer;user-select:none}
  .chip b{color:#fff;font-weight:600}
  .card{width:260px;max-height:70vh;overflow:auto;border-radius:10px;background:#fafafa;color:#111;font-size:12px;box-shadow:0 6px 24px rgba(0,0,0,.18);border:1px solid #e4e4e4}
  .hd{padding:10px 10px 6px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
  .bd{padding:0 10px 10px;line-height:1.45}
  .row{display:flex;justify-content:space-between;margin:3px 0;gap:8px}
  .kv{flex:1;min-width:0}
  .k{color:#666;font-size:10px}
  .v{word-break:break-word}
  .warn{color:#a30}
  .btn{font:11px inherit;color:#2563eb;cursor:pointer;background:none;border:none;padding:0}
  .details{margin-top:6px;padding-top:6px;border-top:1px solid #e5e5e5;font-size:10px}
  a{color:#2563eb}
  .mini{font-size:10px;color:#666}
  `;

  const wrap = doc.createElement("div");
  wrap.className = "wrap";

  const chip = doc.createElement("div");
  chip.className = "chip";
  chip.setAttribute("role", "button");
  const chipB = doc.createElement("b");
  chipB.textContent = "Spectyra";
  const chipH = doc.createElement("span");
  chip.appendChild(chipB);
  chip.appendChild(chipH);

  const card = doc.createElement("div");
  card.className = "card";

  const hd = doc.createElement("div");
  hd.className = "hd";
  const hdL = doc.createElement("span");
  hdL.textContent = "Spectyra";
  const close = doc.createElement("button");
  close.className = "btn";
  close.type = "button";
  close.textContent = "Minimize";
  hd.appendChild(hdL);
  hd.appendChild(close);

  const bd = doc.createElement("div");
  bd.className = "bd";

  const moreRow = doc.createElement("div");
  moreRow.className = "row";
  const more = doc.createElement("button");
  more.className = "btn";
  more.type = "button";
  more.textContent = "▸ Full details";
  moreRow.appendChild(more);
  moreRow.appendChild(doc.createElement("div"));

  const det = doc.createElement("div");
  det.className = "details";
  det.style.display = "none";

  bd.appendChild(moreRow);
  bd.appendChild(det);
  card.appendChild(hd);
  card.appendChild(bd);
  wrap.appendChild(chip);
  wrap.appendChild(card);
  shadow.appendChild(style);
  shadow.appendChild(wrap);

  let minimized = !defaultOpen;
  let showDetails = false;

  function setChip() {
    chipH.textContent = minimized ? " +" : " −";
    card.style.display = minimized ? "none" : "block";
  }
  setChip();

  const row = (label: string, value: string, vClass: string) => {
    const r = doc.createElement("div");
    r.className = "row";
    const a = doc.createElement("div");
    a.className = "kv";
    const k = doc.createElement("div");
    k.className = "k";
    k.textContent = label;
    const v = doc.createElement("div");
    v.className = "v" + (vClass ? " " + vClass : "");
    v.textContent = value;
    a.appendChild(k);
    a.appendChild(v);
    r.appendChild(a);
    bd.insertBefore(r, moreRow);
  };

  const clear = () => {
    while (bd.firstChild && bd.firstChild !== moreRow) {
      bd.removeChild(bd.firstChild!);
    }
  };

  const render = () => {
    clear();
    if (minimized) return;
    const s = opts.getSession();
    const e = opts.getEntitlement();
    const q = e?.quota;
    const summ = s.getSavingsSummary();
    const lr = s.getLastRun();
    const surface = opts.config.productSurface ?? "in_app";
    const paused = summ.optimizationPaused || (q && !q.canRunOptimized);
    let stateLine = "Active";
    if (paused) {
      if (q?.detail) stateLine = `Paused · ${q.state}`;
      else if (q && !q.canRunOptimized) {
        stateLine =
          surface === "in_app" ? "Optimization paused (billing / plan)" : "Paused (entitlement / limit)";
      } else {
        stateLine = "Paused";
      }
    }
    row("State", stateLine, paused ? "warn" : "");
    row("Env", opts.environmentLabel, "");
    row("Requests", String(s.requestCount), "");
    row("Savings (est. USD)", summ.totalEstimatedSavingsUsd.toFixed(4), "");
    row("Avg. savings %", summ.averageSavingsPct.toFixed(1) + "%", "");
    const pm = getPricingSnapshotMeta();
    if (pm.version) {
      const fetchedMs = pm.fetchedAt ? Date.parse(pm.fetchedAt) : NaN;
      const ageSec =
        Number.isFinite(fetchedMs) ? Math.max(0, Math.round((Date.now() - fetchedMs) / 1000)) : 0;
      row("Pricing version", pm.version, pm.stale ? "warn" : "");
      row("Pricing snapshot age", `${ageSec}s (ttl ${pm.ttlSeconds}s)`, pm.stale ? "warn" : "");
    }
    if (q) {
      row("Plan", q.plan, "");
      row("Quota", q.limit == null ? `${q.used} used` : `${q.used} / ${q.limit} (${q.percentUsed?.toFixed(0) ?? "?"}%)`, "");
      if (q.canRunOptimized && q.state === "approaching_limit") {
        row(" ", "Approaching free-tier limit", "warn");
      }
      if (!q.canRunOptimized) {
        const msg =
          q.detail ??
          (surface === "in_app" ?
            "Spectyra optimization is paused for this workspace (billing, plan, or API key). Provider calls still work."
          : "Spectyra optimization paused (entitlement / limit).");
        row(" ", msg, "warn");
        if (q.upgradeUrl) {
          const a = doc.createElement("a");
          a.href = q.upgradeUrl;
          a.target = "_blank";
          a.rel = "noreferrer";
          a.textContent = "Open dashboard / upgrade";
          const r2 = doc.createElement("div");
          r2.className = "row";
          r2.appendChild(a);
          bd.insertBefore(r2, moreRow);
        }
      }
    }
    if (e?.lastError) {
      row("Entitlement", e.lastError, "warn");
    }

    det.textContent = "";
    if (showDetails) {
      if (lr) {
        const pre = doc.createElement("div");
        pre.className = "mini";
        pre.textContent = [
          `Model: ${lr.model}`,
          `In tok: ${lr.report.inputTokensBefore} → ${lr.report.inputTokensAfter}`,
          `Cost: ${lr.report.estimatedCostBefore.toFixed(5)} → ${lr.report.estimatedCostAfter.toFixed(5)}`,
          `Transforms: ${(lr.report.transformsApplied ?? []).join(", ") || "—"}`,
        ].join(" · ");
        det.appendChild(pre);
      } else {
        const pre = doc.createElement("div");
        pre.className = "mini";
        pre.textContent = "No completed run yet in this page session.";
        det.appendChild(pre);
      }
      const pm2 = getPricingSnapshotMeta();
      if (pm2.version) {
        const hdr = doc.createElement("div");
        hdr.className = "k";
        hdr.style.marginTop = "8px";
        hdr.textContent = "Pricing details";
        det.appendChild(hdr);
        const pr = doc.createElement("div");
        pr.className = "mini";
        pr.textContent = [
          `version=${pm2.version}`,
          `fetchedAt=${pm2.fetchedAt || "—"}`,
          `ttlSeconds=${pm2.ttlSeconds}`,
          `stale=${pm2.stale ? "yes" : "no"}`,
        ].join(" · ");
        det.appendChild(pr);
      }
    }
  };

  chip.addEventListener("click", () => {
    minimized = !minimized;
    setChip();
    render();
  });
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    minimized = true;
    setChip();
  });
  more.addEventListener("click", (e) => {
    e.stopPropagation();
    showDetails = !showDetails;
    det.style.display = showDetails ? "block" : "none";
    more.textContent = showDetails ? "▾ Full details" : "▸ Full details";
    render();
  });

  setChip();
  render();
  const poll = setInterval(() => {
    if (!minimized) render();
  }, 2000);

  return {
    unmount: () => {
      clearInterval(poll);
      root.remove();
    },
  };
}
