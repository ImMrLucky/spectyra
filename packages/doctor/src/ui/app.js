const $ = (id) => document.getElementById(id);

let lastData = null;
let findingsIndex = [];

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function confPill(c) {
  if (c >= 0.85) return '<span class="pill pill-high">high</span>';
  if (c >= 0.65) return '<span class="pill pill-med">med</span>';
  return '<span class="pill pill-low">low</span>';
}

function renderSummary(data) {
  const s = data.summary ?? {};
  $("summary-cards").innerHTML = `
    <div class="card"><h3>Files scanned</h3><div class="val">${s.filesScanned ?? 0}</div><div class="hint">exclusion-first text walk</div></div>
    <div class="card"><h3>AI findings</h3><div class="val">${s.aiFindings ?? 0}</div><div class="hint">${s.highConfidenceFindings ?? 0} high confidence</div></div>
    <div class="card"><h3>Actionable paths</h3><div class="val">${(data.actionableFilePaths ?? []).length}</div><div class="hint">need integration review</div></div>
    <div class="card"><h3>Providers</h3><div class="val">${Object.keys(s.providers ?? {}).length}</div><div class="hint">unique vendors</div></div>
    <div class="card"><h3>Models</h3><div class="val">${(s.modelsDetected ?? []).length}</div><div class="hint">literals / hints</div></div>
    <div class="card"><h3>Spectyra SDK</h3><div class="val">${s.spectyraInstalled ? "yes" : "no"}</div><div class="hint">any workspace package</div></div>
    <div class="card"><h3>sdk/auto</h3><div class="val">${s.spectyraAutoDetected ? "yes" : "no"}</div><div class="hint">import detected</div></div>
  `;
  $("meta-line").textContent = `${data.scannedAt ?? ""} · ${s.recommendedNextStep ?? ""}`;
}

function renderActionablePaths(data) {
  const paths = data.actionableFilePaths ?? [];
  const sec = $("actionable-section");
  if (!sec) return;
  if (!paths.length) {
    sec.hidden = true;
    return;
  }
  sec.hidden = false;
  $("actionable-hint").textContent = `${paths.length} path(s) with AI usage or integration points (line-level detail is in the tables above).`;
  $("actionable-list").innerHTML = paths.map((p) => `<li><code>${esc(p)}</code></li>`).join("");
}

function renderFileWalk(data) {
  const fw = data.fileWalk;
  const sec = $("filewalk-section");
  if (!sec) return;
  if (!fw) {
    sec.hidden = true;
    return;
  }
  sec.hidden = false;
  const s = data.summary ?? {};
  $("filewalk-summary").textContent = `Walked ${s.filesScanned ?? 0} text files; ${fw.skippedTotal} skip rows; ${fw.directoriesSkipped.length} directory trees not entered (node_modules, dist, …).`;
  const reasons = fw.skippedByReason ?? {};
  const rows = [
    ["Symlinks skipped", reasons.symlink ?? 0],
    ["Secret / key paths skipped", reasons["secret-file"] ?? 0],
    ["Binaries skipped", reasons["binary-file"] ?? 0],
    ["Oversized skipped", reasons["oversized-file"] ?? 0],
    ["Lockfiles skipped", reasons.lockfile ?? 0],
    ["Ignored directory boundaries", reasons["ignored-directory"] ?? 0],
    ["Walk read/permission errors", fw.permissionOrReadErrors ?? 0],
  ];
  $("filewalk-kv").innerHTML = rows
    .map(
      ([k, v]) =>
        `<div class="kv-row"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(String(v))}</span></div>`,
    )
    .join("");
  const samp = fw.skippedSample ?? [];
  $("filewalk-skips").innerHTML = samp
    .slice(0, 80)
    .map(
      (x) =>
        `<li><code>${esc(x.relativePath)}</code> — ${esc(x.reason)}${x.detail ? ` <span class="hint">(${esc(x.detail)})</span>` : ""}</li>`,
    )
    .join("");
}

function renderProviders(data) {
  const prov = data.summary?.providers ?? {};
  const keys = Object.keys(prov);
  if (!keys.length) {
    $("provider-section").hidden = true;
    return;
  }
  $("provider-section").hidden = false;
  $("provider-map").innerHTML = keys.map((k) => `<span>${esc(k)}: <strong>${prov[k]}</strong></span>`).join("");
}

function renderSteps(data) {
  const recs = data.recommendations ?? [];
  if (!recs.length) {
    $("steps-section").hidden = true;
    return;
  }
  $("steps-section").hidden = false;
  $("checklist").innerHTML = recs
    .map(
      (r, i) => `
    <li>
      <div class="pri">${esc(r.priority)}</div>
      <div class="body">
        <h4>${i + 1}. ${esc(r.title)}</h4>
        <p>${esc(r.summary)}</p>
        ${r.suggestedCode ? `<pre class="snip">${esc(r.suggestedCode)}</pre>` : ""}
      </div>
    </li>`,
    )
    .join("");
}

function renderTable(data) {
  const rows = data.aiFindings ?? [];
  findingsIndex = rows;
  if (!rows.length) {
    $("table-section").hidden = true;
    return;
  }
  $("table-section").hidden = false;
  $("findings-body").innerHTML = rows
    .map(
      (f, idx) => `
    <tr data-idx="${idx}">
      <td>${confPill(f.confidence)} ${Math.round((f.confidence ?? 0) * 100)}%</td>
      <td><span class="badge ${f.provider === "openai" ? "badge-openai" : ""}">${esc(f.provider)}</span></td>
      <td>${esc((f.modelHints ?? []).join(", ") || "—")}</td>
      <td>${esc(f.usageType)}</td>
      <td>${esc(f.callStyle)}</td>
      <td><code>${esc(f.relativePath)}</code></td>
      <td>${f.line}</td>
    </tr>`,
    )
    .join("");

  $("findings-body").querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => {
      const idx = parseInt(tr.getAttribute("data-idx") ?? "0", 10);
      openDetail(findingsIndex[idx]);
    });
  });
}

function openDetail(f) {
  if (!f) return;
  const d = $("detail-content");
  d.innerHTML = `
    <h3>${esc(f.relativePath)}:${f.line}</h3>
    <p><strong>Provider:</strong> ${esc(f.provider)} · <strong>Usage:</strong> ${esc(f.usageType)} · <strong>Style:</strong> ${esc(
      f.callStyle,
    )}</p>
    <p><strong>Evidence:</strong> ${esc((f.providerEvidence ?? []).join(", "))}</p>
    <p><strong>Models:</strong> ${esc((f.modelHints ?? []).join(", ") || "—")}</p>
    <p><strong>Env hints:</strong> ${esc((f.envHints ?? []).join(", ") || "—")}</p>
    <h4>Snippet</h4>
    <pre class="snip">${esc(f.snippet)}</pre>
    <h4>Recommendation</h4>
    <p>${esc(f.recommendation?.summary ?? "")}</p>
    <pre class="snip">${esc(f.recommendation?.suggestedCode ?? "")}</pre>
    <button type="button" class="btn" id="copy-snippet">Copy snippet</button>
  `;
  $("detail-drawer").classList.add("open");
  $("detail-backdrop").classList.add("open");
  $("copy-snippet")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(f.recommendation?.suggestedCode ?? f.snippet ?? "");
    } catch {
      /* ignore */
    }
  });
}

function closeDetail() {
  $("detail-drawer").classList.remove("open");
  $("detail-backdrop").classList.remove("open");
}

function renderIntegrationPoints(data) {
  const pts = data.integrationPoints ?? [];
  if (!pts.length) {
    $("points-section").hidden = true;
    return;
  }
  $("points-section").hidden = false;
  $("integration-points").innerHTML = pts
    .map(
      (p) => `
    <li>
      <div class="pri">${Math.round(p.confidence * 100)}%</div>
      <div class="body">
        <h4>${esc(p.type)} — <code>${esc(p.relativePath)}</code></h4>
        <p>${esc(p.reason)}</p>
        <p>${esc(p.suggestedAction)}</p>
      </div>
    </li>`,
    )
    .join("");
}

function renderRisks(data) {
  const r = data.risks ?? [];
  if (!r.length) {
    $("risks-section").hidden = true;
    return;
  }
  $("risks-section").hidden = false;
  $("risks-list").innerHTML = r
    .map(
      (x) => `
    <li>
      <div class="pri">${esc(x.level)}</div>
      <div class="body">
        <h4>${esc(x.title)}</h4>
        <p>${esc(x.detail)}</p>
        ${x.fix ? `<p><strong>Fix:</strong> ${esc(x.fix)}</p>` : ""}
      </div>
    </li>`,
    )
    .join("");
}

async function loadResult() {
  const r = await fetch("/api/result");
  const data = await r.json();
  if (!data || !data.projectRoot) return;
  lastData = data;
  $("project-root").textContent = data.projectRoot;
  $("scan-status").textContent = "complete";
  renderSummary(data);
  renderActionablePaths(data);
  renderFileWalk(data);
  renderProviders(data);
  renderSteps(data);
  renderTable(data);
  renderIntegrationPoints(data);
  renderRisks(data);
  $("raw-json").textContent = JSON.stringify(data, null, 2);
}

function addLine(type, message) {
  const li = document.createElement("li");
  li.className = type;
  li.textContent = message;
  $("timeline")?.appendChild(li);
  $("timeline")?.scrollTo(0, $("timeline").scrollHeight);
}

const es = new EventSource("/events");
es.addEventListener("message", (ev) => {
  try {
    const d = JSON.parse(ev.data);
    const t = d.type ?? "progress";
    addLine(t, d.message ?? JSON.stringify(d));
    if (t === "result") {
      $("scan-status").textContent = "complete";
      void loadResult();
    }
    if (t === "error") $("scan-status").textContent = "error";
  } catch {
    addLine("progress", ev.data);
  }
});

$("btn-rescan")?.addEventListener("click", async () => {
  $("scan-status").textContent = "scanning…";
  await fetch("/api/rescan", { method: "POST" });
});

$("apply-placement")?.addEventListener("click", async () => {
  const v = document.querySelector('input[name="placement"]:checked')?.value ?? "not_sure";
  await fetch("/api/set-user-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placement: v }),
  });
  $("scan-status").textContent = "rescanning…";
  await fetch("/api/rescan", { method: "POST" });
});

$("btn-copy-install")?.addEventListener("click", async () => {
  const cmd = lastData?.recommendations?.find((r) => r.installPackage)?.suggestedCode ?? "npm install @spectyra/sdk";
  try {
    await navigator.clipboard.writeText(cmd);
  } catch {
    /* ignore */
  }
});

$("btn-verify")?.addEventListener("click", async () => {
  const rt = ($("runtime-verify-url")?.value ?? "").trim();
  const q = rt ? `?runtimeUrl=${encodeURIComponent(rt)}` : "";
  const r = await fetch(`/api/verify${q}`);
  const j = await r.json();
  $("verify-lines").innerHTML = (j.lines ?? [])
    .map((l) => `<li>${l.ok ? "✅" : "❌"} ${esc(l.label)}${l.detail ? ` — ${esc(l.detail)}` : ""}</li>`)
    .join("");
  const extra = $("verify-runtime-extra");
  if (!extra) return;
  if (!j.runtime) {
    extra.hidden = true;
    extra.innerHTML = "";
    return;
  }
  extra.hidden = false;
  const rtb = j.runtime;
  const bits = [`<p>Bridge base: <code>${esc(rtb.baseUrl)}</code></p>`];
  if (rtb.errors?.length) {
    bits.push(`<h3>Errors</h3><ul>${rtb.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`);
  }
  if (rtb.possiblyMissed?.length) {
    bits.push(
      `<h3>Static scan providers missing from recent events</h3><ul>${rtb.possiblyMissed
        .map((m) => `<li><strong>${esc(m.provider)}</strong> — ${esc(m.files.join(", "))}<br/><span class="hint">${esc(m.reason)}</span></li>`)
        .join("")}</ul>`,
    );
  }
  extra.innerHTML = bits.join("");
});

$("detail-close")?.addEventListener("click", closeDetail);
$("detail-backdrop")?.addEventListener("click", closeDetail);

void (async () => {
  try {
    const r = await fetch("/api/result");
    const data = await r.json();
    if (data?.projectRoot) {
      $("scan-status").textContent = "loaded";
      await loadResult();
    } else {
      $("scan-status").textContent = "waiting for scan…";
    }
  } catch {
    $("scan-status").textContent = "error";
  }
})();
