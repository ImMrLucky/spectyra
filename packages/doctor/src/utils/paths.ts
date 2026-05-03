import { resolve } from "node:path";

export function normalizeProjectRoot(path: string): string {
  return resolve(path);
}
