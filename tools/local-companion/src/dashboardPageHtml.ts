/**
 * Self-contained HTML for the local savings dashboard (served from the companion).
 * Uses same-origin fetches only — works when the page is opened at /dashboard.
 */
export function dashboardPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spectyra — Local savings</title>
  <style>
    :root {
      --bg: #0c1220;
      --card: #141c2e;
      --border: #243044;
      --text: #e8eef8;
      --muted: #8b9cb8;
      --teal: #5dcaa5;
      --teal-dim: rgba(93, 202, 165, 0.15);
      --warn: #e6a23c;
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --sans: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 880px; margin: 0 auto; padding: 28px 20px 48px; }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0 0 4px;
      letter-spacing: -0.02em;
    }
    .sub { color: var(--muted); font-size: 13px; margin: 0 0 20px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 18px; }
    .pill {
      font-family: var(--mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--card);
    }
    .pill.ok { border-color: var(--teal); color: var(--teal); background: var(--teal-dim); }
    .pill.bad { border-color: var(--warn); color: var(--warn); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .card .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .card .val {
      font-family: var(--mono);
      font-size: 1.35rem;
      font-weight: 600;
      color: var(--teal);
    }
    .card .val.dim { color: var(--text); font-size: 1rem; }
    h2 {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin: 0 0 10px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { font-family: var(--mono); font-size: 12px; }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .empty { color: var(--muted); font-size: 13px; padding: 16px 0; }
    .hint {
      margin-top: 24px;
      padding: 14px 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card);
      font-size: 13px;
      color: var(--muted);
    }
    .hint strong { color: var(--text); }
    button.refresh {
      font-family: var(--sans);
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    button.refresh:hover { border-color: var(--teal); color: var(--teal); }
    .err { color: var(--warn); font-size: 13px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Spectyra local savings</h1>
    <p class="sub">Updates every few seconds while this tab is open. OpenClaw traffic using <code>spectyra/smart</code> (or fast/quality) appears here.</p>
    <div class="row">
      <span id="statusPill" class="pill">Checking…</span>
      <button type="button" class="refresh" id="btnRefresh">Refresh now</button>
    </div>
    <div id="err" class="err" hidden></div>
    <div class="grid" id="kpis"></div>
    <h2>Recent workflow sessions</h2>
    <div class="card" style="padding: 0; overflow: hidden;">
      <table>
        <thead><tr><th>Started</th><th>Steps</th><th>Input tokens saved</th><th>Est. savings</th></tr></thead>
        <tbody id="sessionsBody"></tbody>
      </table>
      <div id="sessionsEmpty" class="empty" style="padding: 16px;">No sessions yet — run OpenClaw with a Spectyra model.</div>
    </div>
    <div class="hint">
      <strong>Tip:</strong> Run <code>spectyra-companion dashboard</code> in a terminal to open this page, or bookmark this URL. Spectyra Desktop has a richer Live view if you use the full app.
    </div>
  </div>
  <script>
    const $ = (id) => document.getElementById(id);
    const fmtUsd = (n) => '$' + (typeof n === 'number' && !isNaN(n) ? n.toFixed(4) : '0');
    const fmtInt = (n) => (typeof n === 'number' && !isNaN(n) ? Math.round(n).toLocaleString() : '0');
    const fmtPct = (n) => (typeof n === 'number' && !isNaN(n) ? n.toFixed(1) + '%' : '—');
    const fmtTime = (iso) => {
      try {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? iso : d.toLocaleString();
      } catch { return iso; }
    };

    async function load() {
      $('err').hidden = true;
      let health = null;
      try {
        const hr = await fetch('/health');
        health = hr.ok ? await hr.json() : null;
      } catch (e) {
        $('statusPill').textContent = 'Offline';
        $('statusPill').className = 'pill bad';
        $('err').textContent = 'Could not reach the companion. Is spectyra-companion running?';
        $('err').hidden = false;
        return;
      }

      if (health && health.status === 'ok' && health.service === 'spectyra-local-companion') {
        $('statusPill').textContent = 'Companion online · ' + (health.runMode || 'on');
        $('statusPill').className = 'pill ok';
      } else {
        $('statusPill').textContent = 'Unknown response';
        $('statusPill').className = 'pill bad';
      }

      let summary = { totalRuns: 0, totalTokensSaved: 0, totalCostSaved: 0, avgSavingsPct: 0 };
      try {
        const sr = await fetch('/v1/savings/summary');
        if (sr.ok) summary = await sr.json();
      } catch { /* ignore */ }

      const tokensSaved =
        typeof summary.totalTokensSaved === 'number' ? summary.totalTokensSaved : 0;
      const costSaved =
        typeof summary.totalCostSaved === 'number' ? summary.totalCostSaved : 0;
      const runs = typeof summary.totalRuns === 'number' ? summary.totalRuns : 0;
      const avgPct =
        typeof summary.avgSavingsPct === 'number' ? summary.avgSavingsPct : 0;

      $('kpis').innerHTML =
        '<div class="card"><div class="label">Optimized runs</div><div class="val dim">' + fmtInt(runs) + '</div></div>' +
        '<div class="card"><div class="label">Input tokens saved (all runs)</div><div class="val">' + fmtInt(tokensSaved) + '</div></div>' +
        '<div class="card"><div class="label">Est. cost saved (USD)</div><div class="val">' + fmtUsd(costSaved) + '</div></div>' +
        '<div class="card"><div class="label">Avg savings / run</div><div class="val dim">' + fmtPct(avgPct) + '</div></div>';

      let sessions = [];
      try {
        const ar = await fetch('/v1/analytics/sessions?limit=25');
        if (ar.ok) sessions = await ar.json();
      } catch { /* ignore */ }

      const tbody = $('sessionsBody');
      tbody.innerHTML = '';
      const empty = $('sessionsEmpty');
      if (!Array.isArray(sessions) || sessions.length === 0) {
        empty.style.display = 'block';
        empty.textContent =
          runs > 0
            ? 'No completed multi-step sessions on file yet — the totals above still include every optimized OpenClaw run.'
            : 'No data yet — run OpenClaw with spectyra/smart (or fast/quality) while this page is open.';
      } else {
        empty.style.display = 'none';
        for (const s of sessions.slice().reverse()) {
          const tr = document.createElement('tr');
          const before = s.totalInputTokensBefore || 0;
          const after = s.totalInputTokensAfter || 0;
          const saved = Math.max(0, before - after);
          const usd = s.estimatedWorkflowSavings != null ? s.estimatedWorkflowSavings : 0;
          tr.innerHTML =
            '<td>' + fmtTime(s.startedAt || '') + '</td>' +
            '<td>' + fmtInt(s.totalSteps || 0) + '</td>' +
            '<td>' + fmtInt(saved) + '</td>' +
            '<td>' + fmtUsd(usd) + '</td>';
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
