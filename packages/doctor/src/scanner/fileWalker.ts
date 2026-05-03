import fg from "fast-glob";
import { statSync } from "node:fs";

const IGNORE_GLOBS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.angular/**",
  "**/.cache/**",
  "**/.git/**",
  "**/.env",
  "**/.env.*",
  "**/*.log",
];

const EXT = "**/*.{ts,tsx,js,jsx,mjs,cjs,py}";
const MAX_BYTES = 1_000_000;

export async function walkSourceFiles(projectRoot: string): Promise<string[]> {
  const files = await fg(EXT, {
    cwd: projectRoot,
    ignore: IGNORE_GLOBS,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    dot: false,
  });

  const out: string[] = [];
  for (const f of files) {
    try {
      const st = statSync(f);
      if (st.size <= MAX_BYTES) out.push(f);
    } catch {
      /* skip */
    }
  }
  return out;
}
