const timeline = document.getElementById("timeline");
const projectRootEl = document.getElementById("project-root");
const scanStatusEl = document.getElementById("scan-status");
const findingsEl = document.getElementById("findings");
const dashboard = document.getElementById("dashboard");
const recSection = document.getElementById("recommendations");
const recBody = document.getElementById("rec-body");
const verifyLines = document.getElementById("verify-lines");

function addLine(type, message) {
  const li = document.createElement("li");
  li.className = type;
  li.textContent = message;
  timeline?.appendChild(li);
  timeline?.scrollTo(0, timeline.scrollHeight);
}

const es = new EventSource("/events");
es.addEventListener("message", (ev) => {
  try {
    const d = JSON.parse(ev.data);
    const t = d.type ?? "progress";
    addLine(t, d.message ?? JSON.stringify(d));
    if (t === "result") {
      scanStatusEl.textContent = "complete";
      void loadResult();
    }
    if (t === "error") {
      scanStatusEl.textContent = "error";
    }
  } catch {
    addLine("progress", ev.data);
  }
});

async function loadResult() {
  const r = await fetch("/api/result");
  const data = await r.json();
  if (!data || !data.projectRoot) return;
  projectRootEl.textContent = data.projectRoot;
  dashboard.hidden = false;
  recSection.hidden = false;

  const prov = (data.providers ?? []).map((p) => `<li>${p.provider} (${p.confidence})</li>`).join("");
  const sites = (data.aiCallSites ?? [])
    .slice(0, 30)
    .map((s) => `<li><code>${s.file}</code>${s.line ? `:${s.line}` : ""} — <em>${s.kind}</em></li>`)
    .join("");
  const eps = (data.entrypoints ?? []).map((e) => `<li><code>${e.file}</code> — ${e.type}</li>`).join("");
  const ss = data.spectyraStatus ?? {};
  findingsEl.innerHTML = `
    <h3>Providers</h3><ul>${prov || "<li>(none)</li>"}</ul>
    <h3>AI call files</h3><ul>${sites || "<li>(none)</li>"}</ul>
    <h3>Entrypoints</h3><ul>${eps || "<li>(none)</li>"}</ul>
    <h3>Spectyra</h3>
    <ul>
      <li>@spectyra/sdk: ${ss.sdkInstalled ? "in package.json" : "not listed"}</li>
      <li>import '@spectyra/sdk/auto': ${(ss.sdkAutoImportFiles ?? []).length ? `yes (${(ss.sdkAutoImportFiles ?? []).slice(0, 2).join(", ")})` : "not found"}</li>
      <li>Legacy @spectyra/auto: ${(ss.legacyAutoImportFiles ?? []).length ? "still referenced" : "not detected"}</li>
      <li>startSpectyraAuto: ${ss.hasStartSpectyraAuto ? "found" : "not found"}</li>
      <li>Dev bridge: ${ss.hasDevBridge ? "found" : "not found"}</li>
    </ul>
    ${(ss.info ?? []).length ? `<h3>Migration / tips</h3><ul>${(ss.info ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}
    <h3>Warnings</h3>
    <ul>${(data.warnings ?? []).map((w) => `<li>${w.message}</li>`).join("") || "<li>—</li>"}</ul>
  `;

  const recs = data.recommendations ?? [];
  recBody.innerHTML = recs
    .map(
      (rec) => `
    <article style="margin-bottom:20px">
      <h3>${rec.title}</h3>
      <p>${rec.summary}</p>
      ${rec.targetFile ? `<p><strong>Add near the top of:</strong> <code>${rec.targetFile}</code></p>` : ""}
      ${(rec.codeBlocks ?? [])
        .map(
          (b) => `
        <h4>${b.title}</h4>
        <pre class="code"><code>${escapeHtml(b.code)}</code></pre>
      `,
        )
        .join("")}
    </article>
  `,
    )
    .join("");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.getElementById("apply-placement")?.addEventListener("click", async () => {
  const v = document.querySelector('input[name="placement"]:checked')?.value ?? "not_sure";
  await fetch("/api/set-user-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placement: v }),
  });
  scanStatusEl.textContent = "rescanning…";
  await fetch("/api/rescan");
});

document.getElementById("btn-verify")?.addEventListener("click", async () => {
  const r = await fetch("/api/verify");
  const j = await r.json();
  verifyLines.innerHTML = (j.lines ?? [])
    .map((l) => `<li>${l.ok ? "✅" : "❌"} ${l.label}${l.detail ? ` — ${l.detail}` : ""}</li>`)
    .join("");
});

void (async () => {
  try {
    const r = await fetch("/api/result");
    const data = await r.json();
    if (data?.projectRoot) {
      projectRootEl.textContent = data.projectRoot;
      scanStatusEl.textContent = "loaded";
      await loadResult();
    } else {
      scanStatusEl.textContent = "waiting for scan…";
    }
  } catch {
    scanStatusEl.textContent = "error";
  }
})();
