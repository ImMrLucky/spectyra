import type { SignedGraph } from "./types";

export function buildSignedAdjacency(n: number, edges: SignedGraph["edges"]): number[][] {
  const W: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of edges) {
    if (e.i === e.j) continue;
    W[e.i][e.j] += e.w;
    W[e.j][e.i] += e.w; // enforce symmetry
  }
  return W;
}

export function buildSignedLaplacian(n: number, edges: SignedGraph["edges"]): { L: number[][]; W: number[][]; D: number[] } {
  const W = buildSignedAdjacency(n, edges);
  const D: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += Math.abs(W[i][j]);
    D[i] = s;
  }
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) L[i][j] = D[i] - W[i][j];
      else L[i][j] = -W[i][j];
    }
  }
  return { L, W, D };
}
