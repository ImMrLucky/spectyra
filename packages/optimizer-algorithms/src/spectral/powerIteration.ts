import { dot, normalize } from "../math.js";

export function matVec(A: number[][], x: number[]): number[] {
  const n = A.length;
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += A[i][j] * x[j];
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

export function orthogonalizeToOnes(v: number[]): number[] {
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  return v.map(x => x - mean);
}

function randomInitVector(n: number): number[] {
  return new Array(n).fill(0).map(() => Math.random() - 0.5);
}

function singleRestartLambda2(L: number[][], iters: number): { lambda2: number; v: number[] } {
  const n = L.length;
  let v = randomInitVector(n);
  v = orthogonalizeToOnes(v);
  v = normalize(v);

  const step = 0.15;
  for (let k = 0; k < iters; k++) {
    const Lv = matVec(L, v);
    const rq = rayleighQuotient(L, v);
    const grad = Lv.map((val, i) => val - rq * v[i]);
    v = v.map((vi, i) => vi - step * grad[i]);

    if (k % 5 === 0) {
      v = orthogonalizeToOnes(v);
    }
    v = normalize(v);
  }

  v = orthogonalizeToOnes(v);
  v = normalize(v);
  const lambda2 = Math.max(0, rayleighQuotient(L, v));
  return { lambda2, v };
}

export function estimateLambda2(L: number[][], iters = 150): { lambda2: number; v: number[] } {
  const n = L.length;
  if (n <= 1) return { lambda2: 0, v: [1] };

  const restarts = 3;
  let bestLambda2 = Infinity;
  let bestV: number[] = new Array(n).fill(0);

  for (let r = 0; r < restarts; r++) {
    const result = singleRestartLambda2(L, iters);
    if (result.lambda2 < bestLambda2 && result.lambda2 > 1e-12) {
      bestLambda2 = result.lambda2;
      bestV = result.v;
    }
  }

  if (bestLambda2 === Infinity) bestLambda2 = 0;
  return { lambda2: bestLambda2, v: bestV };
}
