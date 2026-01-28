import { dot, normalize } from "./math";

export function matVec(A: number[][], x: number[]): number[] {
  const n = A.length;
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) {
      s += A[i][j] * x[j];
    }
    y[i] = s;
  }
  return y;
}

export function rayleighQuotient(A: number[][], x: number[]): number {
  const Ax = matVec(A, x);
  const num = dot(x, Ax);
  const den = dot(x, x);
  return den === 0 ? 0 : num / den;
}

/**
 * Estimate lambda2 of Laplacian L by minimizing Rayleigh quotient over vectors orthogonal to 1.
 * MVP approach: run a few iterations of gradient-like update using Ax and re-orthogonalize to 1.
 */
export function estimateLambda2(L: number[][], iters = 60): { lambda2: number; v: number[] } {
  const n = L.length;
  if (n <= 1) return { lambda2: 0, v: [1] };

  // Start with deterministic-ish vector to reduce randomness for demos
  let v: number[] = new Array(n).fill(0).map((_, i) => ((i % 2 === 0) ? 1 : -1));

  // Orthogonalize to constant vector 1
  v = orthogonalizeToOnes(v);
  v = normalize(v);

  const step = 0.15; // small stable step
  for (let k = 0; k < iters; k++) {
    const Lv = matVec(L, v);
    // gradient of Rayleigh quotient approx ~ 2(Lv - rq*v)
    const rq = rayleighQuotient(L, v);
    const grad = Lv.map((val, i) => val - rq * v[i]);
    v = v.map((vi, i) => vi - step * grad[i]);
    v = orthogonalizeToOnes(v);
    v = normalize(v);
  }

  const lambda2 = Math.max(0, rayleighQuotient(L, v));
  return { lambda2, v };
}

export function orthogonalizeToOnes(v: number[]): number[] {
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / n; // projection onto 1 is mean
  return v.map(x => x - mean);
}
