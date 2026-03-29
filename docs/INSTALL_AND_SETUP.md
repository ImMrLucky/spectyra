# Install Spectyra (no source build)

This guide is for **end users** who should not need to clone the repo or run `pnpm make`.

---

## Choose your path

| You are… | Easiest install | What you get |
|----------|-----------------|--------------|
| **Non-developer** — want a window, keys, local dashboard | [**Desktop app**](#desktop-app-download) | GUI + embedded companion (no terminal) |
| **OpenClaw / Claude Code / any “set base URL” tool** | [**Local Companion**](#local-companion-one-command) | OpenAI-compatible server on `localhost` |
| **Building an app** | [**SDK on npm**](#sdk-npm) | `npm install @spectyra/sdk` + a few lines of code |

---

## Desktop app (download)

**Goal:** A normal **desktop installer** — no Node, no SDK, no repo clone. This is for users who **aren’t** wiring the npm SDK into an app (e.g. they want a window, keys, and local analytics only).

### End users

1. **Signed in on the web app:** Open **[spectyra.netlify.app/download](https://spectyra.netlify.app/download)** (after login) — **Desktop app** is also in the sidebar. Download links appear when your team has configured installer URLs on the API server.
2. **Or** use your **product download page** — for example **[spectyra.netlify.app](https://spectyra.netlify.app/)** (or the link your team emails after purchase or trial). The canonical production site may change later; use whatever URL your team publishes.
3. Open **`Spectyra-*.dmg`** (macOS) or **`.exe` / installer** (Windows) and install like any other app.
4. On first launch, the app guides you through **provider API keys** (BYOK) and optional **license** activation.

#### macOS: “Spectyra can’t be opened” / “Apple could not verify…” (Gatekeeper)

That message appears when the app is **not** signed with an **Apple Developer ID** certificate and **notarized** by Apple. It is **expected** for unsigned builds (local dev builds or downloads produced without your signing pipeline). The app is not “flagged as malware”; macOS is refusing to run **unnotarized** software by default.

**Ways to open it anyway (you trust this build):**

1. **Right‑click** `Spectyra.app` (in **Applications** or inside the `.dmg`) → **Open** → confirm **Open** in the dialog. After the first successful launch, double‑click works like a normal app.
2. Or open **System Settings** → **Privacy & Security** → scroll to the message about the blocked app → **Open Anyway**.
3. If you copied the app from a download and it still fails, clear the quarantine flag in Terminal (path must match where the app lives):

   ```bash
   xattr -cr "/Applications/Spectyra.app"
   ```

   Then open the app again.

For a **public** release without this friction, maintainers must **code sign** the Mac build with a **Developer ID Application** identity and **notarize** it (see **[apps/desktop/RELEASING.md](../apps/desktop/RELEASING.md)**).

Shipping the app does **not** require publishing source code on GitHub. You only ship **signed binaries** (DMG, MSI, exe, etc.) from **your** website, CDN, or customer portal.

### If no desktop download is available yet

Use **[Local Companion](#local-companion-one-command)** (terminal + `localhost`) — same optimization engine, no GUI — until a packaged build is hosted for download.

### Maintainers (building & hosting installers)

1. **Build** the app: from the repo root run **`pnpm desktop:dist`** (electron-builder; see `apps/desktop/README.md`). Artifacts land under **`apps/desktop/release/`** (for example **`Spectyra-<version>-mac-x64.dmg`** / **`.zip`** on macOS, NSIS **`.exe`** and **`.zip`** on Windows — exact names follow `electron-builder.yml`).
2. **Sign & notarize** (Apple / Microsoft) per your release process.
3. **Netlify (same deploy as the Angular UI):** The Angular env expects stable filenames under **`apps/web/src/assets/downloads/`**: **`Spectyra-mac.dmg`**, **`Spectyra-windows.exe`**, optional **`Spectyra-windows.zip`**. Copy or rename the built artifacts to those names (see **[apps/desktop/RELEASING.md](../apps/desktop/RELEASING.md)**). Use `git add -f` for gitignored binaries; redeploy Netlify.
4. **Optional override:** To host installers elsewhere (CDN, S3) without changing the web build, set **`DESKTOP_DOWNLOAD_MAC_URL`** and **`DESKTOP_DOWNLOAD_WINDOWS_URL`** on the **API** (Railway). The `/download` page prefers those URLs over same-origin assets.

Optional: CI can produce **`apps/desktop/release/`** on each OS (see [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)).

---

## Local Companion (one command)

**Goal:** Point OpenClaw, env vars, or any OpenAI-compatible client at `http://127.0.0.1:4111/v1` — **no app code changes**.

### Prerequisites

- [Node.js 18+](https://nodejs.org/) installed (LTS is fine).

### Install & run

**Option A — `npx` (nothing global):**

```bash
npx @spectyra/local-companion
```

**Option B — global CLI (run `spectyra-companion` anywhere):**

```bash
npm install -g @spectyra/local-companion
spectyra-companion
```

> Publishing `@spectyra/local-companion` to npm is required for these commands to work for users who don’t use this monorepo. Until then, clone the repo and run `pnpm install && pnpm --filter @spectyra/local-companion exec tsx src/companion.ts` from `tools/local-companion`, or use the **Desktop app**.

Default URL: **`http://127.0.0.1:4111`**

Health check: `curl http://127.0.0.1:4111/health`

### Configure your tool (OpenClaw-style)

1. Start the companion (see above).
2. Set the **OpenAI-compatible base URL** to the companion:

   ```bash
   export OPENAI_BASE_URL=http://127.0.0.1:4111/v1
   ```

   Or set the same value in your tool’s UI (API base URL / custom endpoint).

3. Keep using your **normal provider API key** (OpenAI, Groq, etc.) — the companion forwards to the provider; Spectyra does not replace your key.

4. Optional: set **mode** (off / observe / on) via companion config or Desktop — see [USER_GUIDE.md](./USER_GUIDE.md).

More detail: [`tools/local-companion/README.md`](../tools/local-companion/README.md).

---

## SDK (npm)

**Goal:** Optimize inside your Node/TS app with a few lines of code.

```bash
npm install @spectyra/sdk
```

```typescript
import { createSpectyra } from "@spectyra/sdk";
import { createOpenAIAdapter } from "@spectyra/sdk/adapters/openai";
import OpenAI from "openai";

const spectyra = createSpectyra({ runMode: "on" }); // or "observe" for dry-run / projected savings
const openai = new OpenAI();

const result = await spectyra.complete(
  { client: openai, model: "gpt-4o-mini", messages: [{ role: "user", content: "Hello" }] },
  createOpenAIAdapter(openai),
);
```

Full API: [`packages/sdk/README.md`](../packages/sdk/README.md).

---

## Quick comparison

| Method | Code changes | Prompts leave your machine? |
|--------|----------------|-----------------------------|
| Desktop | None | No |
| Local Companion | None (env / base URL only) | No |
| SDK | Small wrapper | No |

---

## Maintainer: Supabase auth (sign-up links & email branding)

The Angular app passes **`emailRedirectTo`** on **sign-up** and **magic-link** sign-in so confirmation links use the **current browser origin** (e.g. `https://spectyra.netlify.app/`). If there is no `http(s)` origin (unusual), it falls back to **`publicSiteUrl`** in `apps/web/src/environments/environment*.ts`.

You must align the **Supabase project** with your real URLs and (optionally) your own email delivery:

1. **Authentication → URL Configuration**
   - **Site URL:** set to your production site (e.g. `https://spectyra.netlify.app`), **not** `http://localhost:3000` — that default is why confirmation links used to send users to localhost.
   - **Redirect URLs:** allow the origins users actually use, for example:
     - `https://spectyra.netlify.app/**`
     - `https://*.netlify.app/**` (preview deploys)
     - `http://localhost:4200/**` (local `ng serve`)

2. **Emails from Spectyra instead of a generic Supabase sender**  
   By default, mail is sent through Supabase’s infrastructure and looks like “from Supabase.” To use **your domain and branding**:
   - **Project Settings → Authentication → SMTP Settings** — enable **Custom SMTP** (SendGrid, Postmark, AWS SES, Resend, etc.) and set **sender name** and **from address** (e.g. `Spectyra <noreply@yourdomain.com>`). Add the DNS records (SPF/DKIM) your provider requires.
   - **Authentication → Email Templates** — edit “Confirm signup”, “Magic link”, etc., for product copy and layout.

---

## Troubleshooting

- **Companion won’t start:** Check port `4111` is free; change port in companion config if needed.
- **401 from provider:** Your provider key must be set in the Desktop app, companion env, or tool — Spectyra forwards with **your** key.
- **Need help:** See [USER_GUIDE.md](./USER_GUIDE.md) and [README.md](../README.md).
