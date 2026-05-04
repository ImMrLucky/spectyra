const $ = (id) => document.getElementById(id);

let lastData = null;
let findingsIndex = [];
let currentFindingFilter = "all";

async function copyText(text) {
  const value = String(text ?? "");
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function setButtonStatus(btn, text, ms = 1400) {
  if (!btn) return;
  const old = btn.textContent;
  btn.textContent = text;
  window.setTimeout(() => {
    btn.textContent = old;
  }, ms);
}

async function ensureLatestResult() {
  if (lastData?.projectRoot) return lastData;
  try {
    const r = await fetch("/api/result");
    const data = await r.json();
    if (data?.projectRoot) {
      lastData = data;
      return data;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function firstInstallCommand(data) {
  const installStep = (data?.integrationPlan?.steps ?? []).find((s) => s.kind === "install-sdk" && s.codeBlocks?.length);
  const planCommand = installStep?.codeBlocks?.find((b) => b.language === "bash")?.code ?? installStep?.codeBlocks?.[0]?.code;
  if (planCommand) return planCommand;
  return data?.recommendations?.find((r) => r.installPackage)?.suggestedCode ?? "npm install @spectyra/sdk";
}

function runChecklistText(data) {
  const monitorStep = (data?.integrationPlan?.steps ?? []).find((s) => s.kind === "open-monitor");
  const block = monitorStep?.codeBlocks?.[0]?.code;
  if (block) return block;
  return `Ready to monitor:
1. Restart your app.
2. Use the app feature that makes an LLM call.
3. Open the Spectyra SDK monitor overlay or local companion.
4. Confirm provider, model, token usage, waste signals, and estimated savings.

Common env:
SPECTYRA_RUN_MODE=on
SPECTYRA_LICENSE_KEY=<your Spectyra API key>
SPECTYRA_ENVIRONMENT=development`;
}

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
    <div class="card"><h3>Provider SDK/API Calls</h3><div class="val">${s.providerSdkFindings ?? 0}</div><div class="hint">direct SDK/custom wrappers</div></div>
    <div class="card"><h3>AI CLI Harness Calls</h3><div class="val">${s.cliHarnessFindings ?? 0}</div><div class="hint">Claude, Gemini, Codex, custom CLI</div></div>
    <div class="card"><h3>Direct HTTP AI Calls</h3><div class="val">${s.httpFindings ?? 0}</div><div class="hint">provider API endpoints</div></div>
    <div class="card"><h3>Framework Calls</h3><div class="val">${s.frameworkFindings ?? 0}</div><div class="hint">Vercel AI, LangChain, LlamaIndex</div></div>
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

function codeCard(block, attrs = "") {
  return `
    <div class="code-card">
      <div class="code-title">
        <span>${esc(block.title)}</span>
        <button type="button" class="btn btn-small" ${attrs}>${esc(block.copyLabel ?? "Copy")}</button>
      </div>
      <pre class="snip">${esc(block.code)}</pre>
    </div>`;
}

function renderIntegrationPlan(data) {
  const plan = data.integrationPlan;
  const sec = $("integration-plan-section");
  if (!sec) return;
  if (!plan) {
    sec.hidden = true;
    return;
  }

  sec.hidden = false;
  $("integration-plan-headline").textContent = plan.headline ?? "Integration setup plan";
  $("integration-plan-summary").textContent = plan.summary ?? "";
  $("integration-plan-status").textContent = `${plan.status ?? "unknown"} · ${Math.round(plan.score ?? 0)}%`;
  const bar = $("integration-plan-progress");
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(plan.score ?? 0)))}%`;

  const steps = plan.steps ?? [];
  const grouped = (plan.tracks ?? []).length
    ? (plan.tracks ?? []).map((track) => [track.title, track.steps ?? [], track])
    : steps.some((s) => s.track === "provider-sdk" || s.track === "ai-cli-harness")
      ? [
          ["Provider SDK/API Integration", steps.filter((s) => s.track === "provider-sdk"), null],
          ["AI CLI Harness Setup", steps.filter((s) => s.track === "ai-cli-harness"), null],
          ["Run and verify", steps.filter((s) => s.track === "operations" || !s.track), null],
        ].filter(([, xs]) => xs.length)
      : [["Setup steps", steps, null]];

  $("integration-plan-steps").innerHTML = grouped
    .map(([trackTitle, trackSteps, track]) => {
      const items = trackSteps
    .map((step, index) => {
      const blocks = (step.codeBlocks ?? [])
        .map((b, blockIndex) => codeCard(b, `data-copy-step="${esc(step.id)}" data-copy-block="${blockIndex}"`))
        .join("");
      const checks = (step.verifyChecks ?? []).length
        ? `<h5>Verify</h5><ul>${step.verifyChecks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : "";
      const notes = (step.notes ?? []).length ? `<h5>Notes</h5><ul>${step.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
      const target = step.targetFile
        ? `<p><strong>File:</strong> <code>${esc(step.targetFile)}</code>${step.targetLine ? `:${step.targetLine}` : ""}</p>`
        : "";
      const pkg = step.packageDir ? `<p><strong>Package:</strong> <code>${esc(step.packageDir)}</code></p>` : "";
      return `
        <li class="plan-step plan-${esc(step.status)}">
          <div class="pri">
            <span class="status-badge">${esc(step.status)}</span>
            <span class="pill pill-low">${esc(step.priority)}</span>
          </div>
          <div class="body">
            <h4>${index + 1}. ${esc(step.title)}</h4>
            <p>${esc(step.summary)}</p>
            ${target}
            ${pkg}
            ${blocks}
            ${checks}
            ${notes}
            <p class="next-action"><strong>Next:</strong> ${esc(step.nextAction)}</p>
          </div>
        </li>`;
    })
    .join("");
      const trackSummary = track?.summary ? `<p class="hint">${esc(track.summary)}</p>` : "";
      const trackStatus = track?.status ? `<span class="status-badge">${esc(track.status)}</span>` : "";
      const cliClass = track?.kind === "ai-cli-harness" ? " cli-track" : "";
      return `<li class="track-title${cliClass}"><div><h4>${esc(trackTitle)}</h4>${trackSummary}</div>${trackStatus}</li>${items}`;
    })
    .join("");

  document.querySelectorAll("[data-copy-step]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const stepId = btn.getAttribute("data-copy-step");
      const blockIndex = Number(btn.getAttribute("data-copy-block") ?? "0");
      const step = (plan.steps ?? []).find((s) => s.id === stepId);
      const block = step?.codeBlocks?.[blockIndex];
      if (!block) return;
      const ok = await copyText(block.code);
      setButtonStatus(btn, ok ? "Copied" : "Copy failed");
    });
  });
}

function renderTable(data) {
  const rows = data.aiFindings ?? [];
  const visibleRows = rows.filter(matchesFindingFilter);
  findingsIndex = visibleRows;
  if (!rows.length) {
    $("table-section").hidden = true;
    return;
  }
  $("table-section").hidden = false;
  $("findings-body").innerHTML = visibleRows
    .map(
      (f, idx) => `
    <tr data-idx="${idx}">
      <td>${confPill(f.confidence)} ${Math.round((f.confidence ?? 0) * 100)}%</td>
      <td><span class="badge ${f.provider === "openai" ? "badge-openai" : ""}">${esc(f.cliTool ? `${cliToolLabel(f.cliTool)} CLI` : f.provider)}</span></td>
      <td>${esc((f.modelHints ?? []).join(", ") || "—")}</td>
      <td>${esc(f.usageType)}</td>
      <td><span class="badge">${esc(styleLabel(f))}</span></td>
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

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === currentFindingFilter);
  });
}

function matchesFindingFilter(f) {
  if (currentFindingFilter === "all") return true;
  if (currentFindingFilter === "provider") return f.callStyle === "sdk" || f.callStyle === "custom-wrapper";
  if (currentFindingFilter === "framework") return f.callStyle === "framework";
  if (currentFindingFilter === "http") return f.callStyle === "http";
  if (currentFindingFilter === "cli") return f.callStyle === "cli" || f.isCliHarness;
  if (currentFindingFilter === "config") return f.callStyle === "config" || f.callStyle === "env";
  return true;
}

function styleLabel(f) {
  if (f.callStyle === "cli" || f.isCliHarness) return "CLI Harness";
  if (f.callStyle === "sdk" || f.callStyle === "custom-wrapper") return "SDK/API";
  if (f.callStyle === "framework") return "Framework";
  if (f.callStyle === "http") return "HTTP";
  return f.callStyle ?? "unknown";
}

function cliToolLabel(tool) {
  if (tool === "claude") return "Claude";
  if (tool === "gemini") return "Gemini";
  if (tool === "codex") return "Codex";
  if (tool === "custom-ai-cli") return "Custom AI";
  return tool;
}

function openDetail(f) {
  if (!f) return;
  const d = $("detail-content");
  const wrapperStep = (lastData?.integrationPlan?.steps ?? []).find(
    (s) =>
      (s.kind === "wrap-llm-call" || s.kind === "wrap-central-client") &&
      s.provider === f.provider &&
      (s.targetFile === f.relativePath || s.summary?.includes(`${f.relativePath}:${f.line}`) || s.id?.includes(String(f.line))),
  );
  const blocks = (wrapperStep?.codeBlocks ?? [])
    .map((b, idx) => codeCard(b, `data-detail-copy="${idx}"`))
    .join("");
  d.innerHTML = `
    <h3>${esc(f.relativePath)}:${f.line}</h3>
    <p><strong>Provider:</strong> ${esc(f.provider)} · <strong>Usage:</strong> ${esc(f.usageType)} · <strong>Call style:</strong> ${esc(styleLabel(f))}</p>
    ${
      f.isCliHarness
        ? `<div class="cli-callout"><strong>AI CLI harness detected.</strong> This app calls an AI command-line tool instead of a provider SDK. Spectyra should wrap the command boundary for duplicate run suppression, retry/loop detection, prompt optimization, CLI result caching, and monitor analytics.</div>
    <p><strong>Best wrapper:</strong> <code>${esc(cliFactoryFor(f))}</code></p>
    <p><strong>Command:</strong> <code>${esc(f.command ?? "—")}</code> <strong>Args:</strong> <code>${esc((f.commandArgs ?? []).join(" ") || "—")}</code> <strong>Streaming:</strong> ${f.isStreaming ? "yes" : "no"}</p>
    <p class="hint">Exact token/cost data may be estimated unless the CLI exposes structured usage metadata.</p>`
        : `<p><strong>Best wrapper:</strong> <code>${esc(providerWrapperFor(f))}</code></p>`
    }
    <p><strong>Evidence:</strong> ${esc((f.providerEvidence ?? []).join(", "))}</p>
    <p><strong>Models:</strong> ${esc((f.modelHints ?? []).join(", ") || "—")}</p>
    <p><strong>Env hints:</strong> ${esc((f.envHints ?? []).join(", ") || "—")}</p>
    <h4>Snippet</h4>
    <pre class="snip">${esc(f.snippet)}</pre>
    <h4>Recommendation</h4>
    <p>${esc(f.recommendation?.summary ?? "")}</p>
    <pre class="snip">${esc(f.recommendation?.suggestedCode ?? "")}</pre>
    ${wrapperStep ? `<h4>Wrapper setup step</h4><p>${esc(wrapperStep.nextAction)}</p>${blocks}` : ""}
    <button type="button" class="btn" id="copy-snippet">Copy snippet</button>
  `;
  $("detail-drawer").classList.add("open");
  $("detail-backdrop").classList.add("open");
  $("copy-snippet")?.addEventListener("click", async () => {
    const btn = $("copy-snippet");
    const ok = await copyText(f.recommendation?.suggestedCode ?? f.snippet ?? "");
    setButtonStatus(btn, ok ? "Copied" : "Copy failed");
  });
  document.querySelectorAll("[data-detail-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.getAttribute("data-detail-copy") ?? "0");
      const block = wrapperStep?.codeBlocks?.[idx];
      if (!block) return;
      const ok = await copyText(block.code);
      setButtonStatus(btn, ok ? "Copied" : "Copy failed");
    });
  });
}

function cliFactoryFor(f) {
  if (f.cliTool === "claude") return "createClaudeCliHarness";
  if (f.cliTool === "gemini") return "createGeminiCliHarness";
  if (f.cliTool === "codex") return "createCodexCliHarness";
  return "createCliHarness";
}

function providerWrapperFor(f) {
  if (f.provider === "openai" || f.provider === "openai-compatible") return "createOpenAIAdapter";
  if (f.provider === "anthropic") return "createAnthropicAdapter";
  if (f.provider === "groq") return "createGroqAdapter";
  if (f.callStyle === "framework") return "framework monitor hook";
  return "createSpectyra";
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
  renderIntegrationPlan(data);
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

document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFindingFilter = btn.getAttribute("data-filter") ?? "all";
    if (lastData) renderTable(lastData);
  });
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
  const btn = $("btn-copy-install");
  const data = await ensureLatestResult();
  const cmd = firstInstallCommand(data);
  const ok = await copyText(cmd);
  setButtonStatus(btn, ok ? "Copied install command" : "Copy failed");
});

$("btn-verify")?.addEventListener("click", async () => {
  await runVerify();
});

async function runVerify() {
  const btn = $("btn-verify");
  const list = $("verify-lines");
  const extra = $("verify-runtime-extra");
  if (btn) btn.textContent = "Verifying…";
  if (list) list.innerHTML = `<li class="hint">Running verification…</li>`;
  try {
    const rt = ($("runtime-verify-url")?.value ?? "").trim();
    const q = rt ? `?runtimeUrl=${encodeURIComponent(rt)}` : "";
    const r = await fetch(`/api/verify${q}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? `Verify failed (${r.status})`);
    if (list) {
      list.innerHTML = (j.lines ?? [])
        .map((l) => `<li><span class="${l.ok ? "verify-ok" : "verify-bad"}">${l.ok ? "OK" : "Needs work"}</span> ${esc(l.label)}${l.detail ? ` — ${esc(l.detail)}` : ""}</li>`)
        .join("");
    }
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
  } catch (e) {
    if (list) list.innerHTML = `<li class="verify-bad">Verify failed — ${esc(e?.message ?? e)}</li>`;
    if (extra) {
      extra.hidden = true;
      extra.innerHTML = "";
    }
  } finally {
    if (btn) btn.textContent = "Verify integration";
    $("verify-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

$("btn-copy-run-checklist")?.addEventListener("click", async () => {
  const btn = $("btn-copy-run-checklist");
  const data = await ensureLatestResult();
  const ok = await copyText(runChecklistText(data));
  setButtonStatus(btn, ok ? "Copied checklist" : "Copy failed");
});

$("btn-jump-verify")?.addEventListener("click", () => {
  $("verify-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
