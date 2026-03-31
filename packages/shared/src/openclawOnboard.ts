/**
 * Build the `openclaw onboard ...` CLI and full install lines for wizards + Electron.
 * Official install scripts: https://openclaw.ai (macOS/Linux: bash; Windows: PowerShell).
 */

export type OpenClawOnboardFlow = "quickstart" | "manual";

/** Minimum Node.js for OpenClaw (per OpenClaw docs). */
export const OPENCLAW_NODE_VERSION_MIN = "22.14";

export const OPENCLAW_INSTALL_BASH = "curl -fsSL https://openclaw.ai/install.sh | bash";

export const OPENCLAW_INSTALL_POWERSHELL = "iwr -useb https://openclaw.ai/install.ps1 | iex";

export interface OpenClawOnboardOptions {
  flow?: OpenClawOnboardFlow;
  /** When set, adds --mode remote --remote-url <url> */
  mode?: "remote";
  remoteUrl?: string;
}

export type OpenClawInstallPlatform = "darwin" | "win32" | "linux" | "other";

/** Returns null if the URL is not a safe ws(s) URL for shell use. */
export function validateOpenClawRemoteUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/[;&|`$()<>\n\r]/.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "wss:" && u.protocol !== "ws:") return null;
    if (!u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Bash-safe single-quoted string for URLs. */
export function quoteForBashSingle(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/** PowerShell single-quoted string (double single-quote for literal '). */
export function quoteForPowerShellSingle(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function appendOnboardArgs(
  base: string,
  opts: OpenClawOnboardOptions,
  quoteUrl: (u: string) => string,
): string {
  let line = base;
  if (opts.flow === "quickstart") {
    line += " --flow quickstart";
  } else if (opts.flow === "manual") {
    line += " --flow manual";
  }
  if (opts.mode === "remote") {
    const url = validateOpenClawRemoteUrl(opts.remoteUrl ?? "");
    if (!url) {
      throw new Error(
        "Remote mode requires a valid WebSocket URL (ws: or wss:), e.g. wss://gateway-host:18789",
      );
    }
    line += ` --mode remote --remote-url ${quoteUrl(url)}`;
  }
  return line;
}

/**
 * Full `openclaw onboard` command for bash (macOS / Linux / Git Bash).
 * @throws if remote mode is set but URL is missing or invalid
 */
export function buildOpenClawOnboardCli(opts: OpenClawOnboardOptions = {}): string {
  return appendOnboardArgs("openclaw onboard", opts, quoteForBashSingle);
}

/**
 * Same onboard flags for Windows PowerShell (different URL quoting).
 * @throws if remote mode is set but URL is missing or invalid
 */
export function buildOpenClawOnboardPowerShell(opts: OpenClawOnboardOptions = {}): string {
  return appendOnboardArgs("openclaw onboard", opts, quoteForPowerShellSingle);
}

/**
 * Single-line install + onboard for Terminal / bash.
 * Not used on Windows — use {@link buildOpenClawWindowsInstallPs1Content} there.
 */
export function buildOpenClawFullInstallBashLine(opts: OpenClawOnboardOptions = {}): string {
  return `${OPENCLAW_INSTALL_BASH} && ${buildOpenClawOnboardCli(opts)}`;
}

/**
 * Full install for a platform: bash one-liner (macOS/Linux) or PowerShell one-liner (Windows).
 */
export function buildOpenClawFullInstallLine(
  opts: OpenClawOnboardOptions = {},
  platform: OpenClawInstallPlatform = "other",
): string {
  if (platform === "win32") {
    return `${OPENCLAW_INSTALL_POWERSHELL}; ${buildOpenClawOnboardPowerShell(opts)}`;
  }
  return buildOpenClawFullInstallBashLine(opts);
}

/**
 * Multi-line PowerShell script for Windows (preferred over a single `-Command` string).
 * Run with: `powershell -NoExit -ExecutionPolicy Bypass -File script.ps1`
 */
export function buildOpenClawWindowsInstallPs1Content(opts: OpenClawOnboardOptions = {}): string {
  const onboard = buildOpenClawOnboardPowerShell(opts);
  return `${OPENCLAW_INSTALL_POWERSHELL}
${onboard}`;
}
