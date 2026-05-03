import { chmodSync, constants, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { walkProjectTree } from "./fileWalker.js";

function root() {
  const r = join(tmpdir(), `spectyra-fw-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(r, { recursive: true });
  return r;
}

describe("walkProjectTree", () => {
  it("recursively scans nested paths and many text extensions", async () => {
    const r = root();
    mkdirSync(join(r, "deep", "nested"), { recursive: true });
    writeFileSync(join(r, "deep", "nested", "app.vue"), "<script>openai</script>", "utf8");
    writeFileSync(join(r, "x.svelte"), "export {}", "utf8");
    writeFileSync(join(r, "p.astro"), "---\n---", "utf8");
    writeFileSync(join(r, "main.go"), "package main", "utf8");
    writeFileSync(join(r, "Main.java"), "class Main {}", "utf8");
    writeFileSync(join(r, "Prog.cs"), "class Prog {}", "utf8");
    writeFileSync(join(r, "hi.php"), "<?php", "utf8");
    writeFileSync(join(r, "lib.rb"), "def x", "utf8");
    writeFileSync(join(r, "lib.rs"), "fn main()", "utf8");
    writeFileSync(join(r, "cfg.json"), "{}", "utf8");
    writeFileSync(join(r, "cfg.yaml"), "a: 1", "utf8");
    writeFileSync(join(r, "readme.md"), "# doc", "utf8");
    writeFileSync(join(r, "page.mdx"), "export const x = 1", "utf8");
    writeFileSync(join(r, "Dockerfile"), "FROM node:20", "utf8");
    writeFileSync(join(r, "docker-compose.yml"), "services: {}", "utf8");
    writeFileSync(join(r, "random-extension-xyz"), "plain text for doctor", "utf8");
    try {
      const res = await walkProjectTree({ rootDir: r, maxFileSizeBytes: 500_000 });
      const rels = new Set(res.files.map((f) => f.relativePath.replace(/\\/g, "/")));
      expect(rels.has("deep/nested/app.vue")).toBe(true);
      expect(rels.has("x.svelte")).toBe(true);
      expect(rels.has("p.astro")).toBe(true);
      expect(rels.has("main.go")).toBe(true);
      expect(rels.has("Main.java")).toBe(true);
      expect(rels.has("Prog.cs")).toBe(true);
      expect(rels.has("hi.php")).toBe(true);
      expect(rels.has("lib.rb")).toBe(true);
      expect(rels.has("lib.rs")).toBe(true);
      expect(rels.has("cfg.json")).toBe(true);
      expect(rels.has("cfg.yaml")).toBe(true);
      expect(rels.has("readme.md")).toBe(true);
      expect(rels.has("page.mdx")).toBe(true);
      expect(rels.has("Dockerfile")).toBe(true);
      expect(rels.has("docker-compose.yml")).toBe(true);
      expect(rels.has("random-extension-xyz")).toBe(true);
      for (const f of res.files) {
        expect(f.relativePath.startsWith("..")).toBe(false);
        expect(f.relativePath).not.toMatch(/^\//);
      }
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("skips node_modules, dist, build, .next, .git, .venv, coverage and records ignored-directory", async () => {
    const r = root();
    for (const d of ["node_modules/x", "dist", "build", ".next", ".git/hooks", ".venv/lib", "coverage/lcov"]) {
      mkdirSync(join(r, ...d.split("/")), { recursive: true });
      writeFileSync(join(r, ...d.split("/"), "a.ts"), "openai", "utf8");
    }
    writeFileSync(join(r, "ok.ts"), "openai", "utf8");
    try {
      const res = await walkProjectTree({ rootDir: r });
      const rels = res.files.map((f) => f.relativePath.replace(/\\/g, "/"));
      expect(rels).toContain("ok.ts");
      expect(rels.some((p) => p.includes("node_modules"))).toBe(false);
      expect(rels.some((p) => p.startsWith("dist/"))).toBe(false);
      expect(rels.some((p) => p.startsWith("build/"))).toBe(false);
      expect(rels.some((p) => p.startsWith(".next/"))).toBe(false);
      expect(rels.some((p) => p.includes(".git/"))).toBe(false);
      expect(rels.some((p) => p.startsWith(".venv/"))).toBe(false);
      expect(rels.some((p) => p.startsWith("coverage/"))).toBe(false);
      expect(res.skipped.some((s) => s.reason === "ignored-directory")).toBe(true);
      expect(res.directoriesSkipped.length).toBeGreaterThan(0);
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("skips .env and .env.production but scans safe env templates", async () => {
    const r = root();
    writeFileSync(join(r, ".env"), "SECRET=1", "utf8");
    writeFileSync(join(r, ".env.production"), "SECRET=1", "utf8");
    writeFileSync(join(r, ".env.example"), "OPENAI_API_KEY=", "utf8");
    writeFileSync(join(r, ".env.sample"), "X=", "utf8");
    writeFileSync(join(r, ".env.template"), "Y=", "utf8");
    writeFileSync(join(r, ".env.production.example"), "SAFE=", "utf8");
    writeFileSync(join(r, ".env.local.example"), "SAFE2=", "utf8");
    try {
      const res = await walkProjectTree({ rootDir: r });
      const rels = new Set(res.files.map((f) => f.relativePath));
      expect(rels.has(".env.example")).toBe(true);
      expect(rels.has(".env.sample")).toBe(true);
      expect(rels.has(".env.template")).toBe(true);
      expect(rels.has(".env.production.example")).toBe(true);
      expect(rels.has(".env.local.example")).toBe(true);
      expect(rels.has(".env")).toBe(false);
      expect(rels.has(".env.production")).toBe(false);
      expect(res.skipped.filter((s) => s.reason === "secret-file").length).toBeGreaterThanOrEqual(2);
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("skips lockfiles, binaries by extension and content, oversized files, and symlinks", async () => {
    const r = root();
    writeFileSync(join(r, "package-lock.json"), "{}", "utf8");
    writeFileSync(join(r, "photo.png"), "not-really-png-text", "utf8");
    writeFileSync(join(r, "fake.ts"), Buffer.alloc(80, 0));
    writeFileSync(join(r, "big.txt"), "x".repeat(500));
    try {
      symlinkSync("/etc/hosts", join(r, "hostslink"));
    } catch {
      /* windows or permissions */
    }
    try {
      const res = await walkProjectTree({ rootDir: r, maxFileSizeBytes: 200 });
      const rels = new Set(res.files.map((f) => f.relativePath));
      expect(rels.has("package-lock.json")).toBe(false);
      expect(rels.has("photo.png")).toBe(false);
      expect(rels.has("fake.ts")).toBe(false);
      expect(rels.has("big.txt")).toBe(false);
      expect(res.skipped.some((s) => s.reason === "lockfile")).toBe(true);
      expect(res.skipped.some((s) => s.reason === "binary-file")).toBe(true);
      expect(res.skipped.some((s) => s.reason === "oversized-file")).toBe(true);
      const sym = res.skipped.filter((s) => s.reason === "symlink");
      if (sym.length) {
        expect(sym.some((s) => s.relativePath === "hostslink")).toBe(true);
      }
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("skips public/build subtree", async () => {
    const r = root();
    mkdirSync(join(r, "public", "build", "assets"), { recursive: true });
    writeFileSync(join(r, "public", "build", "assets", "x.js"), "openai", "utf8");
    writeFileSync(join(r, "public", "ok.txt"), "safe", "utf8");
    try {
      const res = await walkProjectTree({ rootDir: r });
      const rels = new Set(res.files.map((f) => f.relativePath.replace(/\\/g, "/")));
      expect(rels.has("public/ok.txt")).toBe(true);
      expect([...rels].some((p) => p.includes("public/build"))).toBe(false);
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("records read/permission skips without throwing", async () => {
    if (process.platform === "win32") return;
    const r = root();
    mkdirSync(join(r, "readable"), { recursive: true });
    writeFileSync(join(r, "readable", "a.txt"), "hello openai", "utf8");
    const noRead = join(r, "noread");
    mkdirSync(noRead, { recursive: true });
    writeFileSync(join(r, "noread", "b.txt"), "x", "utf8");
    try {
      try {
        chmodSync(noRead, 0);
        const res = await walkProjectTree({ rootDir: r });
        expect(res.files.some((f) => f.relativePath.replace(/\\/g, "/").endsWith("readable/a.txt"))).toBe(true);
        expect(res.skipped.some((s) => s.reason === "permission-error" || s.reason === "read-error")).toBe(true);
      } finally {
        try {
          chmodSync(noRead, constants.S_IRWXU);
        } catch {
          /* ignore */
        }
      }
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("aggregates skipped reasons on result", async () => {
    const r = root();
    writeFileSync(join(r, "yarn.lock"), "x", "utf8");
    mkdirSync(join(r, "node_modules", "z"), { recursive: true });
    try {
      const res = await walkProjectTree({ rootDir: r });
      expect(res.skipped.filter((s) => s.reason === "lockfile").length).toBeGreaterThanOrEqual(1);
      expect(res.skipped.length).toBeGreaterThan(0);
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });
});
