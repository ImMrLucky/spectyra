/**
 * Repo Context Helpers
 * 
 * Utilities for capturing repository context for CodeMap optimization.
 * Designed for VM-based agents that need to read files from disk.
 */

import type { RepoContext } from "./types";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Options for capturing repo context
 */
export interface CaptureRepoContextOptions {
  rootPath: string;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  maxBytes?: number;
  changedFiles?: string[]; // If provided, prioritize these files
  entrypoints?: string[]; // Entry point files to always include
  languageHint?: string;
}

/**
 * Default include patterns (common code files)
 */
const DEFAULT_INCLUDE = [
  "**/*.ts",
  "**/*.js",
  "**/*.tsx",
  "**/*.jsx",
  "**/*.py",
  "**/*.go",
  "**/*.rs",
  "**/*.java",
  "**/*.cpp",
  "**/*.c",
];

/**
 * Default exclude patterns (dependencies, build artifacts)
 */
const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/__pycache__/**",
  "**/*.pyc",
  "**/.next/**",
  "**/.nuxt/**",
];

/**
 * Check if a file path matches a glob pattern
 * Simple implementation - for production, use a proper glob library
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".");
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

/**
 * Check if file should be included
 */
function shouldInclude(
  filePath: string,
  includeGlobs: string[],
  excludeGlobs: string[]
): boolean {
  // Check excludes first
  for (const exclude of excludeGlobs) {
    if (matchesGlob(filePath, exclude)) {
      return false;
    }
  }
  
  // Check includes
  if (includeGlobs.length === 0) {
    return true; // No includes = include all
  }
  
  for (const include of includeGlobs) {
    if (matchesGlob(filePath, include)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Read file content safely
 */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
    return null;
  }
}

/**
 * Get changed files from git (if available)
 */
async function getChangedFiles(rootPath: string): Promise<string[]> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync("git diff --name-only", {
      cwd: rootPath,
    });
    
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(file => path.join(rootPath, file));
  } catch {
    return [];
  }
}

/**
 * Capture repository context for CodeMap optimization
 * 
 * Reads files from the repository, respecting .gitignore patterns,
 * and builds a RepoContext suitable for CodeMap.
 * 
 * @example
 * ```ts
 * const repoContext = await captureRepoContext({
 *   rootPath: "/path/to/repo",
 *   includeGlobs: ["**/*.ts", "**/*.tsx"],
 *   excludeGlobs: ["**/node_modules/**", "**/dist/**"],
 *   maxBytes: 100000, // 100KB
 *   entrypoints: ["src/index.ts", "src/app.ts"],
 * });
 * 
 * const { messages } = await wrapClaudeRequest({
 *   messages: claudeMessages,
 *   repoContext,
 *   mode: "code",
 * });
 * ```
 */
export async function captureRepoContext(
  options: CaptureRepoContextOptions
): Promise<RepoContext> {
  const {
    rootPath,
    includeGlobs = DEFAULT_INCLUDE,
    excludeGlobs = DEFAULT_EXCLUDE,
    maxBytes = 500000, // 500KB default
    changedFiles: providedChangedFiles,
    entrypoints = [],
    languageHint,
  } = options;
  
  // Get changed files if not provided
  let changedFiles = providedChangedFiles;
  if (!changedFiles) {
    changedFiles = await getChangedFiles(rootPath);
  }
  
  // Normalize paths
  const normalizedRoot = path.resolve(rootPath);
  const normalizedChanged = changedFiles.map(f => path.resolve(f));
  const normalizedEntrypoints = entrypoints.map(e => path.resolve(normalizedRoot, e));
  
  // Collect files to include
  const filesToRead: string[] = [];
  
  // Always include entrypoints
  for (const entrypoint of normalizedEntrypoints) {
    if (!filesToRead.includes(entrypoint)) {
      filesToRead.push(entrypoint);
    }
  }
  
  // Prioritize changed files
  for (const changedFile of normalizedChanged) {
    if (!filesToRead.includes(changedFile)) {
      filesToRead.push(changedFile);
    }
  }
  
  // Walk directory for additional files
  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(normalizedRoot, fullPath);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!shouldInclude(relativePath + "/", includeGlobs, excludeGlobs)) {
            continue;
          }
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          // Check if should include
          if (shouldInclude(relativePath, includeGlobs, excludeGlobs)) {
            if (!filesToRead.includes(fullPath)) {
              filesToRead.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Failed to read directory ${dir}:`, error);
    }
  }
  
  // Walk the root directory
  await walkDir(normalizedRoot);
  
  // Read files up to maxBytes
  const files: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;
  
  // Read entrypoints first (always include)
  for (const entrypoint of normalizedEntrypoints) {
    if (filesToRead.includes(entrypoint)) {
      const content = await readFileSafe(entrypoint);
      if (content) {
        const bytes = Buffer.byteLength(content, "utf-8");
        if (totalBytes + bytes <= maxBytes) {
          files.push({
            path: path.relative(normalizedRoot, entrypoint),
            content,
          });
          totalBytes += bytes;
        }
      }
    }
  }
  
  // Read changed files next
  for (const changedFile of normalizedChanged) {
    if (filesToRead.includes(changedFile) && !normalizedEntrypoints.includes(changedFile)) {
      const content = await readFileSafe(changedFile);
      if (content) {
        const bytes = Buffer.byteLength(content, "utf-8");
        if (totalBytes + bytes <= maxBytes) {
          files.push({
            path: path.relative(normalizedRoot, changedFile),
            content,
          });
          totalBytes += bytes;
        }
      }
    }
  }
  
  // Read remaining files until maxBytes
  for (const filePath of filesToRead) {
    if (normalizedEntrypoints.includes(filePath) || normalizedChanged.includes(filePath)) {
      continue; // Already included
    }
    
    const content = await readFileSafe(filePath);
    if (content) {
      const bytes = Buffer.byteLength(content, "utf-8");
      if (totalBytes + bytes <= maxBytes) {
        files.push({
          path: path.relative(normalizedRoot, filePath),
          content,
        });
        totalBytes += bytes;
      } else {
        // Stop if we'd exceed maxBytes
        break;
      }
    }
  }
  
  return {
    rootPath: normalizedRoot,
    files,
    changedFiles: normalizedChanged.map(f => path.relative(normalizedRoot, f)),
    entrypoints: normalizedEntrypoints.map(e => path.relative(normalizedRoot, e)),
    languageHint,
  };
}
