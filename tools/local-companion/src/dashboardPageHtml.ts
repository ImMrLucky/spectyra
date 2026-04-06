/**
 * Self-contained HTML for the local savings dashboard (served from the companion).
 * Uses same-origin fetches only — works when the page is opened at /dashboard.
 *
 * Brand: Spectyra brand system (spectyra-brand.md)
 */
export function dashboardPageHtml(): string {
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
      --text-muted:      #3d5a78;

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
      color: var(--text-muted);
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

    /* ── Metric cards ───────────────────────────────────── */
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 28px;
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
      color: var(--text-muted);
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
      color: var(--text-muted);
      margin-top: 4px;
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
      margin-bottom: 14px;
    }
    .ba-title {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
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
      color: var(--text-muted);
    }
    .ba-labels .after { color: var(--teal-light); }

    /* ── Sessions ────────────────────────────────────────── */
    .section-title {
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
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
      color: var(--text-muted);
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
      color: var(--text-muted);
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
      color: var(--text-muted);
      font-size: 13px;
      padding: 24px 14px;
      text-align: center;
    }

    /* ── Footer hint ─────────────────────────────────────── */
    .hint {
      margin-top: 24px;
      font-size: 12px;
      color: var(--text-muted);
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

    @media (max-width: 600px) {
      .metrics { grid-template-columns: 1fr; }
      .hero-value { font-size: 1.8rem; }
      .header { flex-direction: column; align-items: flex-start; gap: 12px; }
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

    <div class="hero" id="hero">
      <div class="hero-label">Total estimated savings</div>
      <div class="hero-row">
        <span class="hero-value" id="heroValue">—</span>
        <span class="hero-detail" id="heroDetail"></span>
      </div>
    </div>

    <div class="metrics" id="metrics">
      <div class="metric">
        <div class="metric-label">Optimized calls</div>
        <div class="metric-value" id="mRuns">—</div>
      </div>
      <div class="metric">
        <div class="metric-label">Avg reduction</div>
        <div class="metric-value teal" id="mPct">—</div>
      </div>
      <div class="metric">
        <div class="metric-label">Tokens saved</div>
        <div class="metric-value teal" id="mTokens">—</div>
        <div class="metric-sub" id="mTokensSub"></div>
      </div>
    </div>

    <div class="before-after" id="baCard">
      <div class="ba-header">
        <span class="ba-title">Context reduction (all calls)</span>
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

    <div class="section-title">
      <span>Recent sessions</span>
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
      Auto-refreshes while open. Run <code>spectyra-companion dashboard</code> to reopen.
    </p>
  </div>

  <script>
    const $ = id => document.getElementById(id);

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

    async function load() {
      $('err').hidden = true;

      // Health
      let health = null;
      try {
        const hr = await fetch('/health');
        health = hr.ok ? await hr.json() : null;
      } catch {
        $('status').className = 'status offline';
        $('statusText').textContent = 'Offline';
        $('err').textContent = 'Cannot reach companion. Is spectyra-companion running?';
        $('err').hidden = false;
        return;
      }

      if (health?.status === 'ok') {
        $('status').className = 'status online';
        const mode = health.runMode === 'observe' ? 'Observe only' : 'Active';
        $('statusText').textContent = mode;
      } else {
        $('status').className = 'status offline';
        $('statusText').textContent = 'Error';
      }

      // Summary
      let s = { totalRuns: 0, totalTokensSaved: 0, totalCostSaved: 0, avgSavingsPct: 0 };
      try {
        const sr = await fetch('/v1/savings/summary');
        if (sr.ok) s = await sr.json();
      } catch {}

      const runs = s.totalRuns || 0;
      const tokensSaved = s.totalTokensSaved || 0;
      const costSaved = s.totalCostSaved || 0;
      const avgPct = s.avgSavingsPct || 0;

      // Hero
      $('heroValue').textContent = fmtUsd(costSaved);
      $('heroDetail').textContent = runs > 0
        ? 'across ' + fmtInt(runs) + ' optimized call' + (runs !== 1 ? 's' : '')
        : '';

      // Metric cards
      $('mRuns').textContent = fmtInt(runs);
      $('mPct').textContent = fmtPct(avgPct);
      $('mTokens').textContent = fmtInt(tokensSaved);
      $('mTokensSub').textContent = tokensSaved > 0
        ? 'fewer input tokens sent'
        : '';

      // Before/After bar — use exact totals if available, else estimate from avg %
      const totalBefore = s.totalTokensBefore || (tokensSaved > 0 && avgPct > 0
        ? tokensSaved / (avgPct / 100)
        : 0);
      const totalAfter = s.totalTokensAfter != null ? s.totalTokensAfter : Math.max(0, totalBefore - tokensSaved);
      const afterPct = totalBefore > 0 ? (totalAfter / totalBefore * 100) : 100;

      $('baPct').textContent = avgPct > 0 ? fmtPct(avgPct) + ' smaller' : '—';
      $('baBarBefore').style.width = '100%';
      $('baBarAfter').style.width = afterPct.toFixed(1) + '%';
      $('baLabelBefore').textContent = 'Before: ' + fmtInt(totalBefore) + ' tokens';
      $('baLabelAfter').textContent = 'After: ' + fmtInt(totalAfter) + ' tokens';

      // Sessions
      let sessions = [];
      try {
        const ar = await fetch('/v1/analytics/sessions?limit=25');
        if (ar.ok) sessions = await ar.json();
      } catch {}

      const tbody = $('sessionsBody');
      const empty = $('sessionsEmpty');
      tbody.innerHTML = '';

      if (!Array.isArray(sessions) || sessions.length === 0) {
        empty.style.display = 'block';
        empty.textContent = runs > 0
          ? 'Individual runs are counted above — multi-step session details appear once a workflow completes.'
          : 'No data yet — route OpenClaw traffic through a Spectyra model to see results.';
      } else {
        empty.style.display = 'none';
        for (const sess of sessions.slice().reverse()) {
          const before = sess.totalInputTokensBefore || 0;
          const after = sess.totalInputTokensAfter || 0;
          const saved = Math.max(0, before - after);
          const usd = sess.estimatedWorkflowSavings || 0;
          const pct = before > 0 ? (saved / before * 100) : 0;

          const tr = document.createElement('tr');
          const pctClass = pct > 0 ? 'positive' : (pct < 0 ? 'negative' : '');
          const pctHtml = pct > 0
            ? '<span class="pct ' + pctClass + '">' + pct.toFixed(0) + '%</span>'
            : '';

          tr.innerHTML =
            '<td>' + relTime(sess.startedAt || '') + '</td>' +
            '<td>' + fmtInt(sess.totalSteps || 0) + '</td>' +
            '<td>' + fmtTokenPair(before, after) + '</td>' +
            '<td><span class="saved">' + fmtUsd(usd) + '</span>' + pctHtml + '</td>';
          tbody.appendChild(tr);
        }
      }
    }

    $('btnRefresh').addEventListener('click', load);
    load();
    setInterval(load, 4000);
  </script>
</body>
</html>`;
}
