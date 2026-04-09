/**
 * Self-contained HTML for the local savings dashboard (served from the companion).
 * Billing calls go to the Spectyra Cloud `/v1` URL in the browser (see Network tab); credentials come from GET /v1/session/billing-auth on the companion.
 *
 * Brand: Spectyra brand system (spectyra-brand.md)
 */
export function dashboardPageHtml(cloudV1Base: string): string {
  const cloudV1Json = JSON.stringify(cloudV1Base.replace(/\/$/, ""));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spectyra Companion</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg:              #0a0f1a;
      --bg-panel:        #0e1521;
      --bg-card:         #121c2e;
      --bg-elevated:     #162236;
      --border:          rgba(55,138,221,0.12);
      --border-bright:   rgba(55,138,221,0.25);
      --text-primary:    #e8f1fb;
      --text-secondary:  #7a9fc0;

      --navy:            #0C447C;
      --navy-deep:       #042C53;
      --navy-mid:        #185FA5;
      --blue:            #378ADD;
      --blue-light:      #85B7EB;
      --blue-pale:       #E6F1FB;

      --teal:            #1D9E75;
      --teal-light:      #5DCAA5;
      --teal-pale-bg:    rgba(29,158,117,0.08);
      --teal-border:     rgba(159,225,203,0.2);

      --amber:           #BA7517;
      --amber-light:     #EF9F27;
      --amber-pale-bg:   rgba(186,117,23,0.08);

      --slate:           #444441;
      --slate-mid:       #888780;
      --slate-light:     #D3D1C7;

      --font-display: 'Source Sans 3', 'Source Sans Pro', sans-serif;
      --font-body:    'DM Sans', sans-serif;
      --font-mono:    'DM Mono', monospace;

      --radius-sm:    4px;
      --radius-md:    8px;
      --radius-lg:    12px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text-primary);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .page { max-width: 860px; margin: 0 auto; padding: 36px 24px 64px; }

    /* ── Header ─────────────────────────────────────────── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
    }
    .brand {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .brand-name {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.3rem;
      letter-spacing: 0.02em;
      color: var(--blue-pale);
    }
    .brand-sub {
      font-family: var(--font-body);
      font-weight: 300;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      border: 0.5px solid var(--border);
      background: var(--bg-card);
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--slate);
    }
    .status.online .status-dot {
      background: var(--teal);
      animation: pulse 2s ease-in-out infinite;
    }
    .status.offline .status-dot { background: var(--amber); }
    .status.online { color: var(--teal-light); border-color: var(--teal-border); }
    .status.offline { color: var(--amber-light); }

    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

    /* ── Hero stat ──────────────────────────────────────── */
    .hero {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 28px 28px 24px;
      margin-bottom: 16px;
    }
    .hero-label {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 400;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    .hero-row {
      display: flex;
      align-items: baseline;
      gap: 16px;
      flex-wrap: wrap;
    }
    .hero-value {
      font-family: var(--font-mono);
      font-size: 2.4rem;
      font-weight: 500;
      color: var(--teal-light);
      letter-spacing: -0.02em;
    }
    .hero-detail {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      font-weight: 400;
      color: var(--text-secondary);
    }
    .hero-pct-block {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin-top: 12px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    .hero-pct-big {
      font-family: var(--font-mono);
      font-size: 1.75rem;
      font-weight: 500;
      color: var(--teal-light);
      letter-spacing: -0.02em;
    }
    .hero-pct-sub {
      font-size: 12px;
      color: var(--text-secondary);
      max-width: 220px;
      line-height: 1.4;
    }

    .filter-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 16px;
      margin-bottom: 20px;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
    }
    .filter-toolbar label {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
    }
    .filter-toolbar select {
      flex: 1;
      min-width: 200px;
      max-width: 420px;
      font-family: var(--font-body);
      font-size: 13px;
      color: var(--text-primary);
      background: var(--bg-elevated);
      border: 0.5px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      cursor: pointer;
    }
    .filter-toolbar select:focus {
      outline: none;
      border-color: var(--blue);
    }

    /* Help tooltips (details/summary) */
    .help-tip { position: relative; flex-shrink: 0; }
    .help-tip summary {
      list-style: none;
      cursor: pointer;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 0.5px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .help-tip summary::-webkit-details-marker { display: none; }
    .help-tip[open] summary {
      color: var(--blue-light);
      border-color: var(--blue);
    }
    .help-tip .help-body {
      position: absolute;
      z-index: 10;
      right: 0;
      top: calc(100% + 6px);
      width: min(340px, 88vw);
      padding: 12px 14px;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.5;
      color: var(--text-secondary);
      background: var(--bg-elevated);
      border: 1px solid var(--border-bright);
      border-radius: var(--radius-md);
      box-shadow: 0 10px 32px rgba(0,0,0,0.4);
    }
    .help-tip .help-body p { margin: 0 0 8px; }
    .help-tip .help-body p:last-child { margin-bottom: 0; }

    .metric-label-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .metric-label-row .metric-label { margin-bottom: 0; }

    .section-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .section-head-row .section-title-text {
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
    }

    /* ── Metric cards ───────────────────────────────────── */
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }
    .metrics-secondary {
      margin-bottom: 20px;
    }
    .metric {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .metric-label {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .metric-value {
      font-family: var(--font-mono);
      font-size: 1.4rem;
      font-weight: 500;
      color: var(--text-primary);
    }
    .metric-value.teal { color: var(--teal-light); }
    .metric-sub {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .insight-blurb {
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-secondary);
      margin-bottom: 20px;
      padding: 0 2px;
    }
    /* ── Before / After bar ─────────────────────────────── */
    .before-after {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px 24px;
      margin-bottom: 28px;
    }
    .ba-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .ba-header .ba-pct { flex-shrink: 0; }
    .ba-title {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
    }
    .ba-pct {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--teal-light);
    }
    .ba-track {
      height: 28px;
      border-radius: var(--radius-sm);
      background: rgba(55,138,221,0.06);
      position: relative;
      overflow: hidden;
    }
    .ba-bar-before {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      background: rgba(55,138,221,0.12);
      border-radius: var(--radius-sm);
    }
    .ba-bar-after {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      background: linear-gradient(90deg, rgba(29,158,117,0.35), rgba(29,158,117,0.2));
      border-right: 2px solid var(--teal);
      border-radius: var(--radius-sm);
    }
    .ba-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-secondary);
    }
    .ba-labels .after { color: var(--teal-light); }

    /* ── Sessions ────────────────────────────────────────── */
    .section-title {
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-refresh {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 400;
      padding: 4px 12px;
      border-radius: var(--radius-sm);
      border: 0.5px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .btn-refresh:hover { border-color: var(--blue); color: var(--blue-light); }

    .sessions-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
      text-align: left;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    td {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 400;
      color: var(--text-secondary);
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--bg-elevated); }
    td .saved { color: var(--teal-light); font-weight: 500; }
    td .pct {
      display: inline-block;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.04em;
      padding: 1px 6px;
      border-radius: var(--radius-sm);
      margin-left: 4px;
    }
    td .pct.positive { background: var(--teal-pale-bg); color: var(--teal-light); }
    td .pct.negative { background: var(--amber-pale-bg); color: var(--amber-light); }

    .empty-state {
      color: var(--text-secondary);
      font-size: 13px;
      padding: 24px 14px;
      text-align: center;
    }

    /* ── Footer hint ─────────────────────────────────────── */
    .hint {
      margin-top: 24px;
      font-size: 12px;
      color: var(--text-secondary);
      text-align: center;
    }
    .hint code {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-secondary);
      padding: 1px 5px;
      background: var(--bg-card);
      border-radius: var(--radius-sm);
      border: 0.5px solid var(--border);
    }

    .err {
      color: var(--amber-light);
      font-size: 13px;
      margin-bottom: 16px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      background: var(--amber-pale-bg);
      border: 0.5px solid rgba(186,117,23,0.25);
    }

    .callout {
      font-size: 13px;
      line-height: 1.55;
      color: var(--text-secondary);
      margin-bottom: 20px;
      padding: 14px 16px;
      border-radius: var(--radius-md);
      background: rgba(55,138,221,0.06);
      border: 0.5px solid var(--border);
    }
    .callout strong { color: var(--blue-light); font-weight: 600; }
    .callout code {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-secondary);
      padding: 1px 5px;
      background: var(--bg-card);
      border-radius: var(--radius-sm);
      border: 0.5px solid var(--border);
    }

    .plan-card .plan-card-inner {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px 16px;
    }
    .plan-card .plan-card-left {
      flex: 1;
      min-width: 0;
    }
    .plan-card-heading-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }
    .plan-card-heading-row > strong {
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 600;
      color: var(--blue-light);
    }
    .plan-overview-tip .help-body {
      width: min(400px, 92vw);
    }
    .help-body-overview-title {
      font-family: var(--font-display);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--blue-light);
      margin: 0 0 10px;
    }
    .help-tip .help-body ul.help-overview-list {
      margin: 10px 0 0;
      padding-left: 1.1em;
    }
    .help-tip .help-body ul.help-overview-list li {
      margin-bottom: 6px;
    }
    .help-tip .help-body ul.help-overview-list strong {
      color: var(--blue-light);
      font-weight: 600;
    }
    .plan-card .btn-subscribe {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--teal-border);
      background: var(--teal-pale-bg);
      color: var(--teal-light);
      cursor: pointer;
      white-space: nowrap;
    }
    .plan-card .btn-subscribe:hover:not(:disabled) {
      border-color: var(--teal-light);
      color: var(--blue-pale);
    }
    .plan-card .btn-subscribe:disabled { opacity: 0.5; cursor: not-allowed; }

    .plan-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      max-width: 560px;
    }
    .plan-actions .btn-plan-secondary,
    .plan-actions .btn-plan-danger {
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      border: 0.5px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
    }
    .plan-actions .btn-plan-secondary:hover:not(:disabled) {
      border-color: var(--blue);
      color: var(--blue-light);
    }
    .plan-actions .btn-plan-danger {
      border-color: rgba(186,117,23,0.35);
      color: var(--amber-light);
    }
    .plan-actions .btn-plan-danger:hover:not(:disabled) {
      border-color: var(--amber-light);
      color: var(--amber-pale-bg);
    }
    .plan-actions .btn-plan-secondary:disabled,
    .plan-actions .btn-plan-danger:disabled { opacity: 0.45; cursor: not-allowed; }

    .plan-manage-wrap {
      position: relative;
      margin-top: 10px;
      max-width: 560px;
    }
    .btn-manage-account {
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      border: 0.5px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
    }
    .btn-manage-account:hover {
      border-color: var(--blue);
      color: var(--blue-light);
    }
    .account-menu {
      position: absolute;
      left: 0;
      top: 100%;
      margin-top: 6px;
      min-width: 220px;
      padding: 6px;
      border-radius: var(--radius-md);
      border: 0.5px solid var(--border);
      background: var(--bg-card);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      z-index: 40;
    }
    /* display:block would override [hidden] on items — hide must win */
    .account-menu button[hidden] {
      display: none !important;
    }
    .account-menu button:not([hidden]) {
      display: block;
      width: 100%;
      text-align: left;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      padding: 8px 10px;
      margin: 0;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .account-menu button:not([hidden]):hover:not(:disabled) {
      background: var(--bg-elevated);
      color: var(--blue-light);
    }
    .account-menu button:not([hidden]):disabled { opacity: 0.4; cursor: not-allowed; }

    /* Do not set display:flex on .modal-backdrop alone — it overrides the HTML [hidden] attribute
       and keeps the overlay visible on load. Only flex when actually shown. */
    .modal-backdrop[hidden] {
      display: none !important;
    }
    .modal-backdrop:not([hidden]) {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(8, 12, 18, 0.72);
      backdrop-filter: blur(4px);
    }
    .modal-panel {
      width: 100%;
      max-width: 400px;
      padding: 20px 22px;
      border-radius: var(--radius-lg);
      border: 0.5px solid var(--border);
      background: var(--bg-card);
      box-shadow: 0 16px 48px rgba(0,0,0,0.35);
    }
    .modal-title {
      font-family: var(--font-display);
      font-size: 14px;
      font-weight: 600;
      color: var(--blue-light);
      margin: 0 0 12px;
    }
    .modal-body {
      font-size: 13px;
      line-height: 1.55;
      color: var(--text-secondary);
      margin-bottom: 18px;
    }
    .modal-body p { margin: 0 0 10px; }
    .modal-body p:last-child { margin-bottom: 0; }
    .modal-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
    }
    .btn-modal-primary {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--teal-border);
      background: var(--teal-pale-bg);
      color: var(--teal-light);
      cursor: pointer;
    }
    .btn-modal-primary:hover { border-color: var(--teal-light); }
    .btn-modal-secondary {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: var(--radius-md);
      border: 0.5px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .btn-modal-secondary:hover {
      border-color: var(--text-secondary);
      color: var(--text-secondary);
    }

    #planSessionHint {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 8px;
      max-width: 560px;
    }

    tr.live-session td {
      background: rgba(29,158,117,0.06);
      border-bottom: 1px solid var(--teal-border);
    }
    .badge-live {
      display: inline-block;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      background: var(--teal-pale-bg);
      color: var(--teal-light);
      margin-right: 6px;
    }

    @media (max-width: 600px) {
      .metrics { grid-template-columns: 1fr; }
      .hero-value { font-size: 1.8rem; }
      .header { flex-direction: column; align-items: flex-start; gap: 12px; }
    }

    .mission-footer {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      line-height: 1.55;
      color: var(--text-secondary);
      text-align: center;
    }
    .mission-footer p {
      margin: 0 auto 8px;
      max-width: 42rem;
    }
    .mission-footer p:last-child {
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <span class="brand-name">Spectyra</span>
        <span class="brand-sub">Companion</span>
      </div>
      <div id="status" class="status">
        <span class="status-dot"></span>
        <span id="statusText">Connecting…</span>
      </div>
    </div>

    <div id="err" class="err" hidden></div>
    <div id="accountGate" class="callout" hidden style="border-color: rgba(186,117,23,0.35)"></div>
    <div id="planCard" class="callout plan-card" hidden style="border-color: rgba(29,158,117,0.35)">
      <div class="plan-card-inner">
        <div class="plan-card-left">
          <div class="plan-card-heading-row">
            <strong>Spectyra plan</strong>
            <details class="help-tip plan-overview-tip">
              <summary aria-label="What this page shows">?</summary>
              <div class="help-body">
                <p class="help-body-overview-title">What this page shows</p>
                <p>This dashboard is <strong>local only</strong>. Dollar amounts are <strong>estimates</strong> from input-token counts and typical model pricing — your real invoice can differ.</p>
                <p>Use the <strong>scope</strong> menu below to switch between everything you have recorded, one live session, or a single completed session.</p>
                <ul class="help-overview-list">
                  <li><strong>Money (top)</strong> — Rough dollars saved on <strong>input</strong> to the AI (smaller prompts = less you pay).</li>
                  <li><strong>Total input % reduced</strong> — Aggregate percentage: (sum of raw input − sum of optimized input) ÷ sum of raw input. This can differ from averages shown per call.</li>
                  <li><strong>Input tokens before → after</strong> — How much text Spectyra sent to the model after shrinking long tool output, trimming repeats, and similar fixes.</li>
                  <li><strong>Scores below</strong> — Extra signals: steadiness, repeated content, and hints (not all are dollars).</li>
                  <li><strong>Reply tokens</strong> — Model output size when the API reports usage.</li>
                </ul>
              </div>
            </details>
          </div>
          <p id="planLine" style="margin:6px 0 0;font-size:13px;color:var(--text-secondary);max-width:560px"></p>
          <p id="planSessionHint" hidden></p>
          <div id="planManageWrap" class="plan-manage-wrap" hidden>
            <button type="button" class="btn-manage-account" id="btnManageAccount" aria-expanded="false" aria-haspopup="true">Manage account</button>
            <div id="accountActionMenu" class="account-menu" hidden role="menu" aria-label="Account actions">
              <button type="button" role="menuitem" id="menuCancelRenewal" hidden>Cancel renewal</button>
              <button type="button" role="menuitem" id="menuReactivateService" hidden>Reactivate service</button>
            </div>
          </div>
        </div>
        <button type="button" class="btn-subscribe" id="btnSubscribe" style="display:none">Activate Savings</button>
      </div>
    </div>
    <div id="calloutZero" class="callout" hidden></div>

    <div class="filter-toolbar">
      <label for="sessionScope">Show stats for</label>
      <select id="sessionScope" aria-label="Filter dashboard by session">
        <option value="all">All sessions (all LLM calls)</option>
        <option value="live:default">Current live session (in progress)</option>
      </select>
      <details class="help-tip">
        <summary aria-label="Help: scope">?</summary>
        <div class="help-body">
          <p><strong>All sessions</strong> adds up every Spectyra-wrapped LLM call stored on this machine (with session tags when available). Use this for overall savings.</p>
          <p><strong>Current live session</strong> is the in-progress workflow for the default OpenClaw session key — updates as you chat.</p>
          <p><strong>Past sessions</strong> (when listed) use completed session totals from disk. New traffic is tagged with a session id so calls after a restart still roll up correctly.</p>
        </div>
      </details>
    </div>

    <div class="hero" id="hero">
      <div class="hero-label-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
        <span class="hero-label">Estimated savings (input cost)</span>
        <details class="help-tip">
          <summary aria-label="Help: estimated savings">?</summary>
          <div class="help-body">
            <p>Sum of per-call <strong>estimated dollar savings on input</strong> for the selected scope. Based on token deltas and model-specific price hints — not an exact bill.</p>
            <p>When a license or run mode prevents sending the optimized prompt to the provider, the UI may still show “could have saved” — see companion health / run mode.</p>
          </div>
        </details>
      </div>
      <div class="hero-row">
        <span class="hero-value" id="heroValue">—</span>
        <span class="hero-detail" id="heroDetail"></span>
      </div>
      <div class="hero-pct-block">
        <span class="hero-pct-big" id="heroAggPct">—</span>
        <span class="hero-pct-sub" id="heroAggPctLabel">of input tokens reduced (aggregate)</span>
        <details class="help-tip">
          <summary aria-label="Help: aggregate percent">?</summary>
          <div class="help-body">
            <p><strong>Aggregate %</strong> = (total input tokens before optimization − total after) ÷ total before × 100 for the selected scope.</p>
            <p>This is the “headline” overall reduction. The <strong>Input shrink (avg)</strong> card is the <em>average</em> of each call’s own savings % — weighted differently, so the two numbers won’t always match.</p>
          </div>
        </details>
      </div>
    </div>

    <div class="metrics" id="metrics">
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">LLM calls</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Number of completed Spectyra-wrapped provider calls in the selected scope (each chat completion / message request counts as one).</p></div></details>
        </div>
        <div class="metric-value" id="mRuns">—</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Input shrink (avg per call)</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Average of each run’s own <strong>estimated savings %</strong>. Useful to see typical per-request reduction; differs from the headline aggregate % when calls have different sizes.</p></div></details>
        </div>
        <div class="metric-value teal" id="mPct">—</div>
        <div class="metric-sub">mean of per-call %</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Input tokens saved</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Sum of (input tokens before − input tokens after) across calls. Same “tokens” your provider would have billed on the input side before optimization.</p></div></details>
        </div>
        <div class="metric-value teal" id="mTokens">—</div>
        <div class="metric-sub" id="mTokensSub"></div>
      </div>
    </div>

    <div class="metrics metrics-secondary" id="metricsInsight">
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Conversation steadiness</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Heuristic 0–100 from flow analysis: higher suggests a calmer, less chaotic context (fewer thrashy edits). Not a dollar metric.</p></div></details>
        </div>
        <div class="metric-value teal" id="mFlow">—</div>
        <div class="metric-sub">0–100, higher = calmer thread</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Repeated content pressure</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>0–100 score for repeated or duplicate-ish patterns in the thread. High values mean more opportunity for Spectyra to dedupe or compress — not necessarily what was already saved on the last call.</p></div></details>
        </div>
        <div class="metric-value" id="mDup">—</div>
        <div class="metric-sub">0–100, higher = more repeat noise</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Messages (total)</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Sum of message-row counts across calls (depth proxy). For a single session view without per-run data, we may show session steps instead.</p></div></details>
        </div>
        <div class="metric-value" id="mTurns">—</div>
        <div class="metric-sub" id="mTurnsSub">all calls added up</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Reply tokens (total)</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Output tokens the model generated, when the provider returns usage (including streaming usage when available). This is not where Spectyra focuses savings, but it helps compare workload size.</p></div></details>
        </div>
        <div class="metric-value" id="mOutTok">—</div>
        <div class="metric-sub" id="mOutTokSub">model output</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Possible retry loops</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Count of runs where we detected an error- or retry-loop style pattern in notes. Use as a quality signal, not a savings line item.</p></div></details>
        </div>
        <div class="metric-value" id="mStuck">—</div>
        <div class="metric-sub">times we flagged a loop</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Repeat chat (estimate)</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Feature-based estimate of tokens tied to repeated chat context that could be avoided — summed across runs. Rough, not provider usage.</p></div></details>
        </div>
        <div class="metric-value teal" id="mRepCtx">—</div>
        <div class="metric-sub">tokens, rough</div>
      </div>
      <div class="metric">
        <div class="metric-label-row">
          <span class="metric-label">Repeat tools (estimate)</span>
          <details class="help-tip"><summary>?</summary><div class="help-body"><p>Feature-based estimate of tokens tied to repeated or bulky tool output. Helps explain why long agent threads are expensive.</p></div></details>
        </div>
        <div class="metric-value teal" id="mRepTool">—</div>
        <div class="metric-sub">tokens, rough</div>
      </div>
    </div>

    <div class="before-after" id="baCard">
      <div class="ba-header">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span class="ba-title" id="baTitle">Input size (selected scope)</span>
          <details class="help-tip">
            <summary aria-label="Help: before after bar">?</summary>
            <div class="help-body">
              <p>Bar length shows <strong>optimized input size vs raw</strong> for the selected scope. The percentage matches the headline aggregate input reduction (total before vs total after).</p>
            </div>
          </details>
        </div>
        <span class="ba-pct" id="baPct">—</span>
      </div>
      <div class="ba-track">
        <div class="ba-bar-before" id="baBarBefore" style="width:100%"></div>
        <div class="ba-bar-after" id="baBarAfter" style="width:100%"></div>
      </div>
      <div class="ba-labels">
        <span id="baLabelBefore">Before: —</span>
        <span class="after" id="baLabelAfter">After: —</span>
      </div>
    </div>

    <div class="section-head-row">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="section-title-text">Recent sessions (live + completed)</span>
        <details class="help-tip">
          <summary aria-label="Help: recent sessions">?</summary>
          <div class="help-body">
            <p>Each row is a <strong>workflow session</strong>: the <strong>Live</strong> row updates during OpenClaw; completed rows are appended when a session finishes. Dollar and % are that session’s own totals — the table is not filtered by the scope menu (scope only changes the summary cards above).</p>
          </div>
        </details>
      </div>
      <button type="button" class="btn-refresh" id="btnRefresh">Refresh</button>
    </div>
    <div class="sessions-card">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Steps</th>
            <th>Before → After</th>
            <th>Saved</th>
          </tr>
        </thead>
        <tbody id="sessionsBody"></tbody>
      </table>
      <div id="sessionsEmpty" class="empty-state">No sessions yet — route traffic through <code>spectyra/smart</code> to see results.</div>
    </div>

    <p class="hint">
      Updates on open and when you switch back to this tab; while linked, data refreshes about every 30s (faster if the account is not linked yet). Use <strong>Refresh</strong> anytime.
    </p>

    <footer class="mission-footer" aria-label="Spectyra mission">
      <p>At Spectyra, we believe the future of AI must be both powerful and responsible.</p>
      <p>
        As part of our core mission, we commit to allocating 10% of all profits to organizations advancing AI safety and
        guardrails.
      </p>
    </footer>
  </div>

  <div id="accountModal" class="modal-backdrop" hidden aria-hidden="true">
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="accountModalTitle">
      <h3 class="modal-title" id="accountModalTitle"></h3>
      <div class="modal-body" id="accountModalBody"></div>
      <div class="modal-actions">
        <button type="button" class="btn-modal-primary" id="accountModalPrimary"></button>
        <button type="button" class="btn-modal-secondary" id="accountModalSecondary"></button>
      </div>
    </div>
  </div>

  <div id="accountResultModal" class="modal-backdrop" hidden aria-hidden="true">
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="accountResultModalTitle">
      <h3 class="modal-title" id="accountResultModalTitle"></h3>
      <div class="modal-body" id="accountResultModalBody"></div>
      <div class="modal-actions">
        <button type="button" class="btn-modal-primary" id="accountResultModalOk">OK</button>
      </div>
    </div>
  </div>

  <script>
    const $ = id => document.getElementById(id);
    const SCOPE_STORAGE_KEY = 'spectyraDashboardScope';
    var SPECTYRA_CLOUD_V1 = ${cloudV1Json};

    async function fetchBillingCredentials() {
      try {
        var ar = await fetch('/v1/session/billing-auth');
        if (!ar.ok) return null;
        return await ar.json();
      } catch (e) {
        return null;
      }
    }
    function billingAuthHeaders(cred) {
      if (!cred || !cred.scheme) return {};
      if (cred.scheme === 'bearer') return { Authorization: 'Bearer ' + cred.credential };
      if (cred.scheme === 'apikey') return { 'X-SPECTYRA-API-KEY': cred.credential };
      return {};
    }
    function stripLeadingSlash(s) {
      s = String(s);
      return s.charAt(0) === '/' ? s.slice(1) : s;
    }
    function trimTrailingSlash(s) {
      s = String(s);
      return s.charAt(s.length - 1) === '/' ? s.slice(0, -1) : s;
    }
    async function billingCloudGet(path) {
      var p = stripLeadingSlash(path);
      var cred = await fetchBillingCredentials();
      var local = function() { return fetch('/v1/' + p); };
      if (!cred) return local();
      var base = trimTrailingSlash(SPECTYRA_CLOUD_V1);
      try {
        return await fetch(base + '/' + p, { headers: billingAuthHeaders(cred) });
      } catch (e) {
        return local();
      }
    }
    async function billingCloudPost(path, body) {
      var p = stripLeadingSlash(path);
      var cred = await fetchBillingCredentials();
      var local = function() {
        return fetch('/v1/' + p, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {}),
        });
      };
      if (!cred) return local();
      var base = trimTrailingSlash(SPECTYRA_CLOUD_V1);
      try {
        return await fetch(base + '/' + p, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, billingAuthHeaders(cred)),
          body: JSON.stringify(body || {}),
        });
      } catch (e) {
        return local();
      }
    }

    function fmtUsd(n) {
      if (typeof n !== 'number' || isNaN(n)) return '\\$0.00';
      if (n >= 1) return '\\$' + n.toFixed(2);
      if (n >= 0.01) return '\\$' + n.toFixed(3);
      return '\\$' + n.toFixed(4);
    }
    function fmtInt(n) {
      if (typeof n !== 'number' || isNaN(n)) return '0';
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
      if (n >= 10_000) return (n / 1_000).toFixed(1) + 'k';
      return Math.round(n).toLocaleString();
    }
    function fmtPct(n) {
      return typeof n === 'number' && !isNaN(n) ? n.toFixed(1) + '%' : '—';
    }
    function fmtTokenPair(before, after) {
      return fmtInt(before) + ' → ' + fmtInt(after);
    }
    function relTime(iso) {
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const diff = Date.now() - d.getTime();
        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
        if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
        return d.toLocaleDateString();
      } catch { return iso; }
    }

    function sessionAggInputPct(sess) {
      const b = sess.totalInputTokensBefore || 0;
      const a = sess.totalInputTokensAfter || 0;
      if (b <= 0) return 0;
      return ((b - a) / b) * 100;
    }

    function rebuildScopeSelect(completedSessions, previousValue) {
      const sel = $('sessionScope');
      const opts = [];
      opts.push({ value: 'all', label: 'All sessions (all LLM calls)' });
      opts.push({ value: 'live:default', label: 'Current live session (in progress)' });
      if (Array.isArray(completedSessions)) {
        for (const sess of completedSessions) {
          if (!sess || !sess.sessionId) continue;
          const sid = String(sess.sessionId);
          const shortId = sid.length > 10 ? sid.slice(0, 8) + '…' : sid;
          opts.push({
            value: 'sess:' + encodeURIComponent(sid),
            label: 'Past session · ' + relTime(sess.startedAt || '') + ' · ' + shortId,
          });
        }
      }
      sel.innerHTML = opts.map((o) =>
        '<option value="' + o.value.replace(/"/g, '&quot;') + '">' + o.label.replace(/</g, '&lt;') + '</option>'
      ).join('');
      const want = previousValue && opts.some((o) => o.value === previousValue) ? previousValue : 'all';
      sel.value = want;
    }

    function applySummaryFromRuns(s, scopeLabel) {
      const runs = s.totalRuns || 0;
      const tokensSaved = s.totalTokensSaved || 0;
      const costSaved = s.totalCostSaved || 0;
      const avgPct = s.avgSavingsPct || 0;
      const aggPct = typeof s.aggregateInputReductionPct === 'number' ? s.aggregateInputReductionPct : 0;
      const totalBefore = s.totalTokensBefore || 0;
      const totalAfter = s.totalTokensAfter != null ? s.totalTokensAfter : Math.max(0, totalBefore - tokensSaved);

      $('heroValue').textContent = fmtUsd(costSaved);
      $('heroDetail').textContent = runs > 0 ? (scopeLabel + ' · input-side estimate') : '';
      $('heroAggPct').textContent = totalBefore > 0 ? fmtPct(aggPct) : '—';
      $('heroAggPctLabel').textContent = 'of input tokens reduced (aggregate · total before vs after)';

      $('mRuns').textContent = runs > 0 ? fmtInt(runs) : '—';
      $('mPct').textContent = runs > 0 ? fmtPct(avgPct) : '—';
      $('mTokens').textContent = runs > 0 ? fmtInt(tokensSaved) : '—';
      $('mTokensSub').textContent = tokensSaved > 0 ? 'fewer input tokens sent' : '';

      const avgFlow = s.avgFlowStabilityPct || 0;
      const avgDup = s.avgDuplicatePatternPct || 0;
      const sumTurns = s.totalMessageTurns || 0;
      const sumOut = s.totalOutputTokens || 0;
      const stuck = s.stuckLoopHints || 0;
      $('mFlow').textContent = runs > 0 && avgFlow > 0 ? avgFlow.toFixed(0) + '%' : '—';
      $('mDup').textContent = runs > 0 && avgDup > 0 ? avgDup.toFixed(0) + '%' : '—';
      $('mTurns').textContent = runs > 0 ? fmtInt(sumTurns) : '—';
      $('mTurnsSub').textContent = 'all calls added up';
      $('mOutTok').textContent = runs > 0 && sumOut > 0 ? fmtInt(sumOut) : '—';
      const outSub = $('mOutTokSub');
      if (outSub) {
        outSub.textContent = sumOut > 0 ? 'from API usage (streaming + non-streaming)' : 'shows when the API reports usage';
      }
      $('mStuck').textContent = runs > 0 ? String(stuck) : '—';
      const repCtx = s.totalRepeatedContextTokensHint || 0;
      const repTool = s.totalRepeatedToolTokensHint || 0;
      $('mRepCtx').textContent = runs > 0 && repCtx > 0 ? fmtInt(repCtx) : (runs > 0 ? '0' : '—');
      $('mRepTool').textContent = runs > 0 && repTool > 0 ? fmtInt(repTool) : (runs > 0 ? '0' : '—');

      const afterBarPct = totalBefore > 0 ? (totalAfter / totalBefore * 100) : 100;
      $('baTitle').textContent = 'Input size (' + scopeLabel + ')';
      $('baPct').textContent = totalBefore > 0 && aggPct > 0 ? fmtPct(aggPct) + ' reduction' : (totalBefore > 0 ? fmtPct(aggPct) : '—');
      $('baBarBefore').style.width = '100%';
      $('baBarAfter').style.width = afterBarPct.toFixed(1) + '%';
      $('baLabelBefore').textContent = 'Before optimization: ' + fmtInt(totalBefore) + ' input tokens';
      $('baLabelAfter').textContent = 'After: ' + fmtInt(totalAfter) + ' input tokens';

      return {
        runs,
        tokensSaved,
        avgPct,
        totalBeforeSum: totalBefore,
        totalAfterSum: totalAfter,
      };
    }

    function applySessionAnalyticsRecord(sess, scopeLabel) {
      if (!sess || !sess.sessionId) {
        $('heroValue').textContent = fmtUsd(0);
        $('heroDetail').textContent = '';
        $('heroAggPct').textContent = '—';
        $('heroAggPctLabel').textContent = 'of input tokens reduced (aggregate)';
        $('mRuns').textContent = '—';
        $('mPct').textContent = '—';
        $('mTokens').textContent = '—';
        $('mTokensSub').textContent = '';
        $('mFlow').textContent = '—';
        $('mDup').textContent = '—';
        $('mTurns').textContent = '—';
        $('mTurnsSub').textContent = 'session steps';
        $('mOutTok').textContent = '—';
        $('mStuck').textContent = '—';
        $('mRepCtx').textContent = '—';
        $('mRepTool').textContent = '—';
        $('baPct').textContent = '—';
        $('baBarAfter').style.width = '100%';
        $('baLabelBefore').textContent = 'Before: —';
        $('baLabelAfter').textContent = 'After: —';
        $('baTitle').textContent = 'Input size (' + scopeLabel + ')';
        return;
      }
      const b = sess.totalInputTokensBefore || 0;
      const a = sess.totalInputTokensAfter || 0;
      const savedTok = Math.max(0, b - a);
      const agg = sessionAggInputPct(sess);
      const usd = sess.estimatedWorkflowSavings || 0;
      const nCalls = sess.totalModelCalls || sess.totalSteps || 0;
      const wfPct = typeof sess.estimatedWorkflowSavingsPct === 'number' ? sess.estimatedWorkflowSavingsPct : 0;
      const avgShow = wfPct > 0 ? wfPct : agg;

      $('heroValue').textContent = fmtUsd(usd);
      $('heroDetail').textContent = nCalls > 0 ? (scopeLabel + ' · input-side estimate') : '';
      $('heroAggPct').textContent = b > 0 ? fmtPct(agg) : '—';
      $('heroAggPctLabel').textContent = 'of input tokens reduced (this session, aggregate)';

      $('mRuns').textContent = nCalls > 0 ? fmtInt(nCalls) : '—';
      $('mPct').textContent = nCalls > 0 ? fmtPct(avgShow) : '—';
      $('mTokens').textContent = nCalls > 0 ? fmtInt(savedTok) : '—';
      $('mTokensSub').textContent = savedTok > 0 ? 'fewer input tokens sent' : '';

      $('mFlow').textContent = '—';
      $('mDup').textContent = '—';
      $('mTurns').textContent = (sess.totalSteps | 0) > 0 ? fmtInt(sess.totalSteps) : '—';
      $('mTurnsSub').textContent = 'steps in this session';
      const out = sess.totalOutputTokens || 0;
      $('mOutTok').textContent = out > 0 ? fmtInt(out) : '—';
      $('mStuck').textContent = '—';
      const rc = sess.repeatedContextTokensAvoided || 0;
      const rt = sess.repeatedToolOutputTokensAvoided || 0;
      $('mRepCtx').textContent = nCalls > 0 ? (rc > 0 ? fmtInt(rc) : '0') : '—';
      $('mRepTool').textContent = nCalls > 0 ? (rt > 0 ? fmtInt(rt) : '0') : '—';

      const afterBarPct = b > 0 ? (a / b * 100) : 100;
      $('baTitle').textContent = 'Input size (' + scopeLabel + ')';
      $('baPct').textContent = b > 0 ? fmtPct(agg) + ' reduction' : '—';
      $('baBarBefore').style.width = '100%';
      $('baBarAfter').style.width = afterBarPct.toFixed(1) + '%';
      $('baLabelBefore').textContent = 'Before optimization: ' + fmtInt(b) + ' input tokens';
      $('baLabelAfter').textContent = 'After: ' + fmtInt(a) + ' input tokens';
    }

    async function postAccountAction(path, body) {
      var r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      var data = await r.json().catch(function() { return {}; });
      if (!r.ok) {
        throw new Error(data.error || data.message || ('Request failed: ' + r.status));
      }
      return data;
    }

    async function refreshPlanCard(health) {
      var card = $('planCard');
      var line = $('planLine');
      var btn = $('btnSubscribe');
      var planManageWrap = $('planManageWrap');
      var planHint = $('planSessionHint');
      var bc = $('menuCancelRenewal');
      var bk = $('menuReactivateService');
      if (!card || !line || !btn) return;
      if (!health || health.spectyraAccountLinked === false) {
        card.hidden = false;
        line.textContent =
          'Connect your Spectyra account (run spectyra-companion setup) to see plan status and billing actions here.';
        btn.style.display = 'none';
        if (planManageWrap) planManageWrap.hidden = true;
        if (planHint) {
          planHint.hidden = true;
          planHint.textContent = '';
        }
        return;
      }
      card.hidden = false;
      line.textContent = 'Loading plan…';
      btn.style.display = 'none';
      if (planManageWrap) planManageWrap.hidden = true;
      if (planHint) {
        planHint.hidden = true;
        planHint.textContent = '';
      }
      try {
        var r = await billingCloudGet('billing/status');
        if (r.status === 503) {
          line.textContent = 'Add your Spectyra API key (run spectyra-companion setup) to manage your plan from this dashboard.';
          return;
        }
        if (!r.ok) {
          var errObj = await r.json().catch(function() { return {}; });
          var errMsg = errObj.error || errObj.message || '';
          line.textContent =
            'Could not load plan status (' + r.status + ')' + (errMsg ? ': ' + errMsg : '') + '.';
          return;
        }
        var st = await r.json();
        var paid = st.subscription_status === 'active' || st.subscription_active === true;
        var hasAccess = st.has_access === true;
        var exempt = !!(st.org_platform_exempt || st.platform_billing_exempt);
        var trialActive = st.trial_active === true;
        var cancelEnd = !!st.cancel_at_period_end;
        var orgName = st.org && st.org.name ? st.org.name : 'your org';
        if (exempt && hasAccess) {
          line.textContent = 'Billing exempt — full access for ' + orgName + '.';
          btn.style.display = 'none';
        } else if (paid && hasAccess) {
          if (cancelEnd) {
            line.textContent =
              'Active subscription — ' +
              orgName +
              '. This plan will cancel at the end of the current billing period.';
          } else {
            line.textContent = 'Active subscription — ' + orgName + '.';
          }
          btn.style.display = 'none';
        } else if (trialActive && hasAccess) {
          var te = st.trial_ends_at ? new Date(st.trial_ends_at) : null;
          line.textContent = 'Trial active' + (te && !isNaN(te.getTime()) ? ' (ends ' + te.toLocaleString() + ')' : '') + '.';
          btn.style.display = 'none';
        } else {
          line.textContent = 'Trial ended or no active paid plan. Activate your account to restore full access to savings.';
          btn.style.display = 'inline-block';
        }
        if (!btn.dataset.boundPlan) {
          btn.dataset.boundPlan = '1';
          btn.addEventListener('click', async function() {
            btn.disabled = true;
            try {
              var origin = window.location.origin;
              var cr = await billingCloudPost('billing/checkout', {
                success_url: origin + '/dashboard?upgraded=1',
                cancel_url: origin + '/dashboard',
                checkout_quantity: 1,
              });
              var data = await cr.json().catch(function() { return {}; });
              if (cr.ok && data.checkout_url) {
                window.open(String(data.checkout_url), '_blank', 'noopener,noreferrer');
              } else {
                alert(data.error || data.message || ('Checkout failed: ' + cr.status));
              }
            } catch (e) {
              alert(e && e.message ? e.message : 'Checkout failed');
            }
            btn.disabled = false;
          });
        }

        if (!planManageWrap || !bc || !bk) return;

        [bc, bk].forEach(function(b) {
          b.hidden = true;
        });
        planManageWrap.hidden = false;

        var sr = await fetch('/v1/account/summary');
        if (!sr.ok) {
          if (planHint) {
            planHint.hidden = false;
            planHint.textContent =
              'Account actions need a valid sign-in. Run: spectyra-companion setup — then refresh this page.';
          }
          planManageWrap.hidden = true;
          return;
        }
        var sum = await sr.json();
        var owned = sum.owned_subscriptions || [];
        var canCancel = false;
        var canKeep = false;
        for (var i = 0; i < owned.length; i++) {
          var o = owned[i];
          var stat = String(o.subscription_status || '').toLowerCase();
          var activeLike = stat === 'active' || stat === 'trialing' || stat === 'past_due';
          if (activeLike && !o.cancel_at_period_end) canCancel = true;
          if (o.cancel_at_period_end) canKeep = true;
        }
        if (canCancel) bc.hidden = false;
        if (canKeep) bk.hidden = false;

        var showManage = !bc.hidden || !bk.hidden;
        planManageWrap.hidden = !showManage;
        var accountMenu = $('accountActionMenu');
        if (accountMenu) accountMenu.hidden = true;
        var btnM = $('btnManageAccount');
        if (btnM) btnM.setAttribute('aria-expanded', 'false');

        if (!planManageWrap.dataset.boundAccount) {
          planManageWrap.dataset.boundAccount = '1';
          function closeAccountMenu() {
            var am = $('accountActionMenu');
            var bm = $('btnManageAccount');
            if (am) am.hidden = true;
            if (bm) bm.setAttribute('aria-expanded', 'false');
          }
          function hideAccountModal() {
            var modal = $('accountModal');
            if (modal) {
              modal.hidden = true;
              modal.setAttribute('aria-hidden', 'true');
            }
          }
          function hideResultModal() {
            var m = $('accountResultModal');
            if (m) {
              m.hidden = true;
              m.setAttribute('aria-hidden', 'true');
            }
          }
          function showResultModal(opts) {
            var titleEl = $('accountResultModalTitle');
            var bodyEl = $('accountResultModalBody');
            var btn = $('accountResultModalOk');
            if (!titleEl || !bodyEl || !btn) return;
            titleEl.textContent = opts.title || 'Done';
            bodyEl.innerHTML = '';
            if (opts.bodyHtml) {
              bodyEl.innerHTML = opts.bodyHtml;
            } else if (opts.plainMessage) {
              var p = document.createElement('p');
              p.textContent = opts.plainMessage;
              bodyEl.appendChild(p);
            }
            btn.textContent = opts.okLabel || 'OK';
            btn.onclick = function() {
              hideResultModal();
              if (opts.onOk) opts.onOk();
            };
            var rm = $('accountResultModal');
            if (rm) {
              rm.hidden = false;
              rm.setAttribute('aria-hidden', 'false');
            }
          }
          function showAccountModal(opts) {
            $('accountModalTitle').textContent = opts.title;
            $('accountModalBody').innerHTML = opts.bodyHtml;
            $('accountModalPrimary').textContent = opts.primaryLabel;
            $('accountModalSecondary').textContent = opts.secondaryLabel;
            $('accountModalPrimary').onclick = function() {
              hideAccountModal();
              if (opts.onPrimary) opts.onPrimary();
            };
            $('accountModalSecondary').onclick = function() {
              hideAccountModal();
              if (opts.onSecondary) opts.onSecondary();
            };
            var modal = $('accountModal');
            modal.hidden = false;
            modal.setAttribute('aria-hidden', 'false');
          }
          $('btnManageAccount').addEventListener('click', function(ev) {
            ev.stopPropagation();
            var menu = $('accountActionMenu');
            if (!menu) return;
            var willOpen = menu.hidden;
            menu.hidden = !willOpen;
            $('btnManageAccount').setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          });
          document.addEventListener('click', function(ev) {
            var wrap = $('planManageWrap');
            if (!wrap || wrap.hidden) return;
            if (wrap.contains(ev.target)) return;
            closeAccountMenu();
          });
          $('accountModal').addEventListener('click', function(ev) {
            if (ev.target === $('accountModal')) hideAccountModal();
          });
          $('accountResultModal').addEventListener('click', function(ev) {
            if (ev.target === $('accountResultModal')) hideResultModal();
          });
          document.addEventListener('keydown', function(ev) {
            if (ev.key === 'Escape') {
              closeAccountMenu();
              hideAccountModal();
              hideResultModal();
            }
          });
          bc.addEventListener('click', function() {
            closeAccountMenu();
            showAccountModal({
              title: 'Cancel renewal?',
              bodyHtml:
                '<p>You’ll stop saving on AI usage if you cancel.</p><p>Are you sure you want to continue without optimization?</p>',
              primaryLabel: 'Keep Saving',
              secondaryLabel: 'Cancel Anyway',
              onSecondary: async function() {
                try {
                  await postAccountAction('/v1/account/subscription/cancel-at-period-end', {});
                  showResultModal({
                    title: 'Renewal cancelled',
                    bodyHtml:
                      '<p>Access continues until the end of the current billing period.</p>',
                    onOk: function() {
                      location.reload();
                    },
                  });
                } catch (e) {
                  showResultModal({
                    title: 'Could not cancel renewal',
                    plainMessage: e && e.message ? e.message : String(e),
                  });
                }
              },
            });
          });
          bk.addEventListener('click', async function() {
            closeAccountMenu();
            try {
              await postAccountAction('/v1/account/subscription/keep', {});
              showResultModal({
                title: 'Subscription reactivated',
                bodyHtml:
                  '<p>Your plan will renew after the current billing period.</p>',
                onOk: function() {
                  location.reload();
                },
              });
            } catch (e) {
              showResultModal({
                title: 'Could not reactivate subscription',
                plainMessage: e && e.message ? e.message : String(e),
              });
            }
          });
        }
      } catch (e) {
        line.textContent = 'Could not reach billing status.';
        btn.style.display = 'none';
        if (planManageWrap) planManageWrap.hidden = true;
      }
    }

    /** While waiting for setup/sign-in, poll a bit faster; once linked, slow down to avoid flicker. */
    var pollTimerId = null;
    var lastPollIntervalMs = 0;
    var POLL_FAST_MS = 5000;
    var POLL_SLOW_MS = 28000;

    function armDashboardPoll(accountLinkedOk) {
      var ms = accountLinkedOk ? POLL_SLOW_MS : POLL_FAST_MS;
      if (pollTimerId !== null && ms === lastPollIntervalMs) return;
      lastPollIntervalMs = ms;
      if (pollTimerId !== null) clearInterval(pollTimerId);
      pollTimerId = setInterval(function() {
        if (document.hidden) return;
        load();
      }, ms);
    }

    async function load() {
      $('err').hidden = true;
      try {
        if (typeof URLSearchParams !== 'undefined' && window.location.search) {
          var q = new URLSearchParams(window.location.search);
          if (q.get('upgraded') === '1') {
            history.replaceState({}, '', '/dashboard');
          }
        }
      } catch (e) {}

      let health = null;
      try {
        const hr = await fetch('/health');
        health = hr.ok ? await hr.json() : null;
      } catch {
        $('status').className = 'status offline';
        $('statusText').textContent = 'Offline';
        $('err').textContent = 'Cannot reach companion. Is spectyra-companion running?';
        $('err').hidden = false;
        armDashboardPoll(false);
        return;
      }

      if (health?.status === 'ok') {
        $('status').className = 'status online';
        var stText = 'Active';
        if (health.spectyraAccountLinked === true && health.billingAllowsRealSavings === false) {
          stText = 'Upgrade to save';
        } else if (health.runMode === 'observe') {
          stText = 'Observe only';
        }
        $('statusText').textContent = stText;
      } else {
        $('status').className = 'status offline';
        $('statusText').textContent = 'Error';
      }

      const ag = $('accountGate');
      if (ag) {
        if (health?.status === 'ok' && health.spectyraAccountLinked === false) {
          ag.hidden = false;
          const em = health.accountEmail ? ' Account email (from session): ' + health.accountEmail + '. ' : '';
          ag.textContent =
            em +
            'Spectyra is not fully linked on this machine. Try refreshing the page once — the companion refreshes your Supabase session from disk when it can. If this message stays, run spectyra-companion setup and sign in so ~/.spectyra/desktop/config.json has a valid session (including refresh token) and your org API key. Until then, input savings stay in preview only.';
        } else {
          ag.hidden = true;
          ag.textContent = '';
        }
      }

      void refreshPlanCard(health);

      let sessions = [];
      try {
        const ar = await fetch('/v1/analytics/sessions?limit=50');
        if (ar.ok) sessions = await ar.json();
      } catch {}

      let liveSession = null;
      try {
        const lr = await fetch('/v1/analytics/current-session?sessionKey=default');
        if (lr.ok) liveSession = await lr.json();
      } catch {}

      let totalRunsGlobal = 0;
      try {
        const gs = await fetch('/v1/savings/summary');
        if (gs.ok) totalRunsGlobal = (await gs.json()).totalRuns || 0;
      } catch {}

      const prevScope = $('sessionScope').value || sessionStorage.getItem(SCOPE_STORAGE_KEY) || 'all';
      rebuildScopeSelect(sessions, prevScope);
      const scope = $('sessionScope').value;
      sessionStorage.setItem(SCOPE_STORAGE_KEY, scope);

      let meta = { runs: 0, tokensSaved: 0, avgPct: 0, totalBeforeSum: 0, totalAfterSum: 0 };

      if (scope === 'all') {
        let s = {};
        try {
          const sr = await fetch('/v1/savings/summary');
          if (sr.ok) s = await sr.json();
        } catch {}
        meta = applySummaryFromRuns(s, 'all calls');
      } else if (scope.indexOf('live:') === 0) {
        const key = decodeURIComponent(scope.slice(5)) || 'default';
        let cur = liveSession;
        if (!cur || !cur.sessionId) {
          try {
            const lr = await fetch('/v1/analytics/current-session?sessionKey=' + encodeURIComponent(key));
            if (lr.ok) cur = await lr.json();
          } catch {}
        }
        applySessionAnalyticsRecord(cur && cur.sessionId ? cur : null, 'live session');
      } else if (scope.indexOf('sess:') === 0) {
        const sid = decodeURIComponent(scope.slice(5));
        let rec = null;
        try {
          const r = await fetch('/v1/analytics/session/' + encodeURIComponent(sid));
          if (r.ok) rec = await r.json();
        } catch {}
        if (rec && rec.sessionId) {
          applySessionAnalyticsRecord(rec, 'selected session');
        } else {
          let s = {};
          try {
            const sr = await fetch('/v1/savings/summary?sessionId=' + encodeURIComponent(sid));
            if (sr.ok) s = await sr.json();
          } catch {}
          if ((s.totalRuns || 0) > 0) {
            meta = applySummaryFromRuns(s, 'calls tagged to session');
          } else {
            applySessionAnalyticsRecord(null, 'session');
          }
        }
      }

      if (scope === 'all') {
        const callout = $('calloutZero');
        const showToolThreadExplain =
          meta.runs > 0 &&
          meta.tokensSaved === 0 &&
          (meta.avgPct || 0) === 0 &&
          meta.totalBeforeSum > 0 &&
          meta.totalBeforeSum === meta.totalAfterSum;
        if (callout) {
          if (showToolThreadExplain) {
            callout.hidden = false;
            callout.innerHTML =
              '<strong>Why is savings still \\$0?</strong><br />' +
              'Common reasons: <strong>no active plan</strong> after trial (projected savings only until you activate), ' +
              '<strong>Observe</strong> run mode (no trimming to the model), ' +
              'or this stretch of calls had no smaller prompt to send. ' +
              'Use the <strong>Live</strong> row for your current OpenClaw session; completed rows appear when a session is finished.';
          } else {
            callout.hidden = true;
            callout.textContent = '';
          }
        }
      } else {
        const callout = $('calloutZero');
        if (callout) { callout.hidden = true; callout.textContent = ''; }
      }

      const tbody = $('sessionsBody');
      const empty = $('sessionsEmpty');
      tbody.innerHTML = '';

      function appendSessionRow(sess, opts) {
        const isLive = opts && opts.live;
        const before = sess.totalInputTokensBefore || 0;
        const after = sess.totalInputTokensAfter || 0;
        const saved = Math.max(0, before - after);
        const usd = sess.estimatedWorkflowSavings || 0;
        const pct = before > 0 ? (saved / before * 100) : 0;
        const tr = document.createElement('tr');
        if (isLive) tr.className = 'live-session';
        const pctClass = pct > 0 ? 'positive' : (pct < 0 ? 'negative' : '');
        const pctHtml = pct > 0
          ? '<span class="pct ' + pctClass + '">' + pct.toFixed(0) + '%</span>'
          : '';
        const whenCell = isLive
          ? '<span class="badge-live">Live</span>' + relTime(sess.startedAt || '')
          : relTime(sess.startedAt || '');
        tr.innerHTML =
          '<td>' + whenCell + '</td>' +
          '<td>' + fmtInt(sess.totalSteps || 0) + '</td>' +
          '<td>' + fmtTokenPair(before, after) + '</td>' +
          '<td><span class="saved">' + fmtUsd(usd) + '</span>' + pctHtml + '</td>';
        tbody.appendChild(tr);
      }

      const hasLive =
        liveSession &&
        typeof liveSession === 'object' &&
        liveSession.sessionId &&
        (liveSession.totalSteps | 0) > 0;

      if (hasLive) {
        empty.style.display = 'none';
        appendSessionRow(liveSession, { live: true });
      }

      if (!Array.isArray(sessions) || sessions.length === 0) {
        if (!hasLive) {
          empty.style.display = 'block';
          empty.textContent = totalRunsGlobal > 0
            ? 'No completed sessions on disk yet — the live row above shows the in-progress workflow when telemetry is on.'
            : 'No data yet — route OpenClaw traffic through a Spectyra model to see results.';
        }
      } else {
        empty.style.display = 'none';
        for (const sess of sessions.slice().reverse()) {
          appendSessionRow(sess, null);
        }
      }

      var linkedOk = health && health.status === 'ok' && health.spectyraAccountLinked === true;
      armDashboardPoll(linkedOk);
    }

    $('sessionScope').addEventListener('change', load);
    $('btnRefresh').addEventListener('click', load);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) load();
    });
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (t && typeof t.closest === 'function' && t.closest('.help-tip')) return;
        document.querySelectorAll('details.help-tip[open]').forEach(function (el) {
          el.removeAttribute('open');
        });
      },
      true,
    );
    load();
  </script>
</body>
</html>`;
}
