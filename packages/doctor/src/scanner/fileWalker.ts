import { closeSync, openSync, readSync } from "node:fs";
import { lstatSync, readdirSync } from "node:fs";
import { isBinaryFileSync } from "isbinaryfile";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type { ScannableFile } from "./types.js";

/** Options for {@link walkProjectTree}. */
export interface FileWalkerOptions {
  rootDir: string;
  followSymlinks?: boolean;
  maxFileSizeBytes?: number;
}

export interface SkippedFile {
  path: string;
  relativePath: string;
  reason:
    | "ignored-directory"
    | "secret-file"
    | "binary-file"
    | "oversized-file"
    | "lockfile"
    | "generated-file"
    | "symlink"
    | "permission-error"
    | "read-error";
  detail?: string;
}

export interface FileWalkerResult {
  rootDir: string;
  files: ScannableFile[];
  skipped: SkippedFile[];
  directoriesSkipped: string[];
  /** Non-fatal issues (e.g. unreadable directory). */
  walkWarnings: string[];
}

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".pnpm-store",
  ".yarn",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".angular",
  ".cache",
  ".git",
  ".hg",
  ".svn",
  ".turbo",
  ".vercel",
  ".netlify",
  "out",
  "vendor",
  "target",
  "bin",
  "obj",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".gradle",
  ".idea",
  ".vscode",
]);

const LOCKFILE_NAMES = new Set(
  [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "composer.lock",
    "gemfile.lock",
    "cargo.lock",
    "poetry.lock",
    "pipfile.lock",
  ].map((s) => s.toLowerCase()),
);

const BINARY_EXTENSIONS = new Set(
  [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".svgz",
    ".pdf",
    ".zip",
    ".gz",
    ".tgz",
    ".tar",
    ".rar",
    ".7z",
    ".mp4",
    ".mov",
    ".avi",
    ".mp3",
    ".wav",
    ".flac",
    ".ttf",
    ".otf",
    ".woff",
    ".woff2",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".class",
    ".jar",
    ".war",
    ".pyc",
  ].map((e) => e.toLowerCase()),
);

const SECRET_KEY_BASENAMES = new Set(["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"].map((s) => s.toLowerCase()));

const SECRET_KEY_EXTENSIONS = new Set([".pem", ".key", ".crt", ".p12", ".pfx"].map((e) => e.toLowerCase()));

const PROBE_BYTES = 1024;

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function isInsideRoot(rootResolved: string, absPath: string): boolean {
  const rel = relative(rootResolved, absPath);
  if (rel === "") return true;
  if (rel.startsWith("..") || isAbsolute(rel)) return false;
  return true;
}

function skipDirectoryDescent(dirRelPosix: string, dirName: string): boolean {
  if (SKIP_DIR_NAMES.has(dirName)) return true;
  const d = dirRelPosix;
  if (d === "public/build" || d.startsWith("public/build/")) return true;
  if (d.endsWith("/public/build") || d.includes("/public/build/")) return true;
  return false;
}

function basenameLower(path: string): string {
  const parts = path.split(/[/\\]/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

function fileExtensionLower(path: string): string | undefined {
  const base = basenameLower(path);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return undefined;
  return base.slice(dot);
}

/** Safe env templates: suffix-based (not exact-only). */
export function isSafeEnvTemplate(base: string): boolean {
  const b = base;
  return (
    b === ".env.example" ||
    b === ".env.sample" ||
    b === ".env.template" ||
    b === ".env.defaults" ||
    b === ".env.dist" ||
    b === ".env.local.example" ||
    b.endsWith(".example") ||
    b.endsWith(".sample") ||
    b.endsWith(".template") ||
    b.endsWith(".defaults") ||
    b.endsWith(".dist") ||
    b.endsWith(".example.local") ||
    b.endsWith(".sample.local") ||
    b.endsWith(".template.local")
  );
}

/** True when this path should never be read (real secrets / non-template .env*). */
export function isSecretEnvPath(relativePath: string): boolean {
  const base = basename(relativePath.replace(/\\/g, "/"));
  if (!base.startsWith(".env")) return false;
  if (isSafeEnvTemplate(base)) return false;
  return true;
}

function isLockfileName(baseLower: string): boolean {
  return LOCKFILE_NAMES.has(baseLower);
}

function isGeneratedNoisyFile(baseLower: string): boolean {
  if (baseLower === ".ds_store" || baseLower === "thumbs.db") return true;
  if (baseLower.endsWith(".min.js") || baseLower.endsWith(".min.css")) return true;
  if (baseLower.endsWith(".map") || baseLower.endsWith(".log") || baseLower.endsWith(".tmp") || baseLower.endsWith(".temp")) {
    return true;
  }
  return false;
}

function isSecretKeyMaterial(relPosix: string): boolean {
  const base = basenameLower(relPosix);
  if (SECRET_KEY_BASENAMES.has(base)) return true;
  const ext = fileExtensionLower(relPosix);
  if (ext && SECRET_KEY_EXTENSIONS.has(ext)) return true;
  return false;
}

function utf8LooksCorrupt(buf: Buffer): boolean {
  const s = buf.toString("utf8");
  const bad = (s.match(/\uFFFD/g) ?? []).length;
  return bad > 2 && bad / Math.max(s.length, 1) > 0.008;
}

function langFromExt(ext: string): string | undefined {
  const e = ext.toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".vue": "vue",
    ".svelte": "svelte",
    ".astro": "astro",
    ".py": "python",
    ".go": "go",
    ".java": "java",
    ".cs": "csharp",
    ".php": "php",
    ".rb": "ruby",
    ".rs": "rust",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".json": "json",
    ".jsonc": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".md": "markdown",
    ".mdx": "markdown",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".html": "html",
    ".htm": "html",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".ps1": "powershell",
    ".svg": "svg",
  };
  return map[e];
}

function classifySkipReason(err: unknown): "permission-error" | "read-error" {
  const code = err && typeof err === "object" && "code" in err ? String((err as NodeJS.ErrnoException).code) : "";
  if (code === "EACCES" || code === "EPERM") return "permission-error";
  return "read-error";
}

/**
 * Recursively walk `rootDir` exclusion-first: all non-ignored text files up to size limit.
 * Uses [isbinaryfile](https://github.com/gjtorikian/isBinaryFile) on a small buffer plus UTF-8 / NUL heuristics.
 */
export async function walkProjectTree(opts: FileWalkerOptions): Promise<FileWalkerResult> {
  const rootDir = resolve(opts.rootDir);
  const maxFileSizeBytes = opts.maxFileSizeBytes ?? 1_000_000;
  const followSymlinksRequested = opts.followSymlinks ?? false;

  const files: ScannableFile[] = [];
  const skipped: SkippedFile[] = [];
  const walkWarnings: string[] = [];
  let warnedFollowSymlinks = false;

  const pushSkip = (abs: string, relPosix: string, reason: SkippedFile["reason"], detail?: string) => {
    skipped.push({ path: abs, relativePath: relPosix, reason, detail });
  };

  const walkDir = (dirAbs: string, dirRelPosix: string) => {
    let entries;
    try {
      entries = readdirSync(dirAbs, { withFileTypes: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      walkWarnings.push(`Could not read directory ${dirRelPosix || "."}: ${msg}`);
      pushSkip(dirAbs, dirRelPosix || ".", classifySkipReason(e), msg);
      return;
    }

    for (const ent of entries) {
      const name = String(ent.name);
      const childAbs = join(dirAbs, name);
      const childRel = dirRelPosix ? `${dirRelPosix}/${name}` : name;
      const childRelPosix = toPosix(childRel);

      if (!isInsideRoot(rootDir, childAbs)) {
        pushSkip(childAbs, childRelPosix, "read-error", "resolves outside project root");
        continue;
      }

      let st: ReturnType<typeof lstatSync>;
      try {
        st = lstatSync(childAbs);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pushSkip(childAbs, childRelPosix, classifySkipReason(e), msg);
        walkWarnings.push(`lstat failed ${childRelPosix}: ${msg}`);
        continue;
      }

      const isSym = st.isSymbolicLink();
      if (isSym) {
        if (followSymlinksRequested && !warnedFollowSymlinks) {
          walkWarnings.push("followSymlinks is not yet supported; symlinks are skipped.");
          warnedFollowSymlinks = true;
        }
        pushSkip(childAbs, childRelPosix, "symlink", "symlinks skipped");
        continue;
      }

      if (st.isDirectory()) {
        if (skipDirectoryDescent(childRelPosix, name)) {
          pushSkip(childAbs, childRelPosix, "ignored-directory", "directory not descended");
          continue;
        }
        walkDir(childAbs, childRelPosix);
        continue;
      }

      if (!st.isFile()) {
        continue;
      }

      const baseLower = basenameLower(childRelPosix);

      if (isLockfileName(baseLower)) {
        pushSkip(childAbs, childRelPosix, "lockfile");
        continue;
      }
      if (isGeneratedNoisyFile(baseLower)) {
        pushSkip(childAbs, childRelPosix, "generated-file");
        continue;
      }
      if (isSecretEnvPath(childRelPosix)) {
        pushSkip(childAbs, childRelPosix, "secret-file", ".env secrets not read");
        continue;
      }
      if (isSecretKeyMaterial(childRelPosix)) {
        pushSkip(childAbs, childRelPosix, "secret-file", "key/cert material");
        continue;
      }

      const extLower = fileExtensionLower(childRelPosix);
      if (extLower && BINARY_EXTENSIONS.has(extLower)) {
        pushSkip(childAbs, childRelPosix, "binary-file", `extension ${extLower}`);
        continue;
      }

      if (st.size === 0) {
        const ext0 = fileExtensionLower(childRelPosix);
        const extension0 = ext0 ? (ext0.startsWith(".") ? ext0 : `.${ext0}`) : undefined;
        files.push({
          path: childAbs,
          relativePath: childRelPosix,
          extension: extension0,
          language: extension0 ? langFromExt(extension0) : undefined,
          sizeBytes: 0,
          reason: "text",
        });
        continue;
      }

      if (st.size > maxFileSizeBytes) {
        pushSkip(childAbs, childRelPosix, "oversized-file", `${st.size} bytes > ${maxFileSizeBytes}`);
        walkWarnings.push(`Skipped oversized file ${childRelPosix} (${st.size} bytes)`);
        continue;
      }

      const sampleLen = Math.min(PROBE_BYTES, Math.max(0, st.size));
      const buf = Buffer.alloc(sampleLen);
      try {
        const fd = openSync(childAbs, "r");
        try {
          readSync(fd, buf, 0, sampleLen, 0);
        } finally {
          closeSync(fd);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pushSkip(childAbs, childRelPosix, classifySkipReason(e), msg);
        walkWarnings.push(`Could not read ${childRelPosix}: ${msg}`);
        continue;
      }

      if (buf.includes(0)) {
        pushSkip(childAbs, childRelPosix, "binary-file", "NUL in first bytes");
        continue;
      }
      if (utf8LooksCorrupt(buf)) {
        pushSkip(childAbs, childRelPosix, "binary-file", "invalid UTF-8 in sample");
        continue;
      }
      if (isBinaryFileSync(buf)) {
        pushSkip(childAbs, childRelPosix, "binary-file", "isbinaryfile heuristic");
        continue;
      }

      const extension = extLower?.startsWith(".") ? extLower : extLower ? `.${extLower}` : undefined;
      const language = extension ? langFromExt(extension) : undefined;

      files.push({
        path: childAbs,
        relativePath: childRelPosix,
        extension,
        language,
        sizeBytes: st.size,
        reason: "text",
      });
    }
  };

  walkDir(rootDir, "");

  const directoriesSkipped = [
    ...new Set(skipped.filter((s) => s.reason === "ignored-directory").map((s) => s.relativePath)),
  ].sort((a, b) => a.localeCompare(b));

  return {
    rootDir,
    files,
    skipped,
    directoriesSkipped,
    walkWarnings,
  };
}

/** @deprecated Prefer {@link walkProjectTree} for skip metadata. */
export async function walkProjectFiles(rootDir: string, opts: Omit<FileWalkerOptions, "rootDir"> = {}): Promise<ScannableFile[]> {
  const r = await walkProjectTree({ rootDir, ...opts });
  return r.files;
}
