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
  // Safe cosine: return 0 for invalid inputs
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  
  // Short-circuit: identical arrays (by reference or deep equality check)
  // For performance, we'll check if they're the same reference first
  if (a === b) return 1;
  
  // Check for identical normalized text (if embeddings are identical, similarity = 1)
  // This is a cheap check - if all values are exactly equal
  let allEqual = true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      allEqual = false;
      break;
    }
  }
  if (allEqual) return 1;
  
  const na = norm2(a);
  const nb = norm2(b);
  if (na === 0 || nb === 0) return 0;
  
  const result = dot(a, b) / (na * nb);
  // Clamp to [-1, 1] for safety
  return Math.max(-1, Math.min(1, result));
}
