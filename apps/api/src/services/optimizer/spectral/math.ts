export function clamp01(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function sigmoid(x: number): number {
  // safe sigmoid
  if (x > 35) return 1;
  if (x < -35) return 0;
  return 1 / (1 + Math.exp(-x));
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm2(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: number[]): number[] {
  const n = norm2(a);
  if (n === 0) return a.map(() => 0);
  return a.map(v => v / n);
}

export function cosine(a?: number[], b?: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  const na = norm2(a);
  const nb = norm2(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}
