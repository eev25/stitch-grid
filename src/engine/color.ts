/* ============================================================
   color.ts — CIELAB conversion, deterministic k-means palette
   extraction, and nearest-color matching (pure: no React, no DOM).
   ============================================================ */
import { hexToRgb } from "./engine";

export type Lab = [number, number, number];

/** Pixel buffer in ImageData layout (RGBA, row-major, unpremultiplied). */
export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Pixels with alpha below this (50%) count as transparent. */
export const ALPHA_MIN = 128;

/** Seed for k-means++ so the same image always yields the same palette. */
export const EXTRACT_SEED = 0x5eed;

/** sRGB byte -> linear-light channel value (0..1). */
export const SRGB_TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// D65 reference white; CIE constants.
const XN = 0.95047, YN = 1, ZN = 1.08883;
const EPS = 216 / 24389, KAPPA = 24389 / 27;
const f = (t: number): number => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
const fInv = (t: number): number => (t * t * t > EPS ? t * t * t : (116 * t - 16) / KAPPA);

/** Linear-light RGB (0..1) -> CIELAB. */
export function linearToLab(r: number, g: number, b: number): Lab {
  const fx = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / XN);
  const fy = f((0.2126729 * r + 0.7151522 * g + 0.072175 * b) / YN);
  const fz = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** sRGB bytes (0..255) -> CIELAB. */
export const rgbToLab = (r: number, g: number, b: number): Lab =>
  linearToLab(SRGB_TO_LINEAR[r], SRGB_TO_LINEAR[g], SRGB_TO_LINEAR[b]);

export function hexToLab(hex: string): Lab {
  const { r, g, b } = hexToRgb(hex);
  return rgbToLab(r, g, b);
}

/** CIELAB -> "#rrggbb", clamped into the sRGB gamut. */
export function labToHex([L, a, b]: Lab): string {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = fInv(fx) * XN;
  const y = (L > KAPPA * EPS ? fy * fy * fy : L / KAPPA) * YN;
  const z = fInv(fz) * ZN;
  const lin = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
  return "#" + lin.map((c) => {
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, "0");
  }).join("");
}

const dist2 = (p: ArrayLike<number>, i: number, q: ArrayLike<number>, j: number): number => {
  const dL = p[i] - q[j], da = p[i + 1] - q[j + 1], db = p[i + 2] - q[j + 2];
  return dL * dL + da * da + db * db;
};

/** Index of the color in `labs` closest to `lab` (CIE76 distance); -1 if empty. */
export function nearestIndex(lab: Lab, labs: Lab[]): number {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < labs.length; i++) {
    const d = dist2(lab, 0, labs[i], 0);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Small seeded PRNG (mulberry32) returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Extract up to `k` representative colors with k-means in CIELAB, seeded by
 * k-means++ from a fixed-seed PRNG (same pixels -> same palette). Pixels with
 * alpha < 50% are ignored. Returns hex colors, most common first; fewer than
 * `k` when the image has fewer distinct colors, empty when nothing is opaque.
 */
export function extractPalette(px: PixelData, k: number, seed = EXTRACT_SEED): string[] {
  const { data } = px;
  const labs: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_MIN) continue;
    const [L, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    labs.push(L, a, b);
  }
  const n = labs.length / 3;
  if (n === 0 || k < 1) return [];
  const P = Float64Array.from(labs);
  const rand = mulberry32(seed);

  // ---- k-means++ seeding ----
  const centers: number[] = [];
  const pick = (i: number) => centers.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  pick(Math.floor(rand() * n));
  const d2 = new Float64Array(n).fill(Infinity);
  while (centers.length / 3 < k) {
    const c = centers.length - 3;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = dist2(P, i * 3, centers, c);
      if (d < d2[i]) d2[i] = d;
      sum += d2[i];
    }
    if (sum === 0) break; // fewer distinct colors than k
    let r = rand() * sum, chosen = -1;
    for (let i = 0; i < n; i++) {
      if (d2[i] === 0) continue;
      chosen = i;
      r -= d2[i];
      if (r <= 0) break;
    }
    pick(chosen);
  }

  // ---- Lloyd iterations ----
  const K = centers.length / 3;
  const C = Float64Array.from(centers);
  const assign = new Int32Array(n).fill(-1);
  const counts = new Float64Array(K);
  for (let iter = 0; iter < 50; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < K; j++) {
        const d = dist2(P, i * 3, C, j * 3);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    if (!changed) break;
    const sums = new Float64Array(K * 3);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const j = assign[i];
      counts[j]++;
      sums[j * 3] += P[i * 3]; sums[j * 3 + 1] += P[i * 3 + 1]; sums[j * 3 + 2] += P[i * 3 + 2];
    }
    for (let j = 0; j < K; j++) {
      if (!counts[j]) continue; // empty cluster keeps its old center
      C[j * 3] = sums[j * 3] / counts[j];
      C[j * 3 + 1] = sums[j * 3 + 1] / counts[j];
      C[j * 3 + 2] = sums[j * 3 + 2] / counts[j];
    }
  }

  const order = Array.from({ length: K }, (_, j) => j)
    .filter((j) => counts[j] > 0)
    .sort((a, b) => counts[b] - counts[a] || a - b);
  const out: string[] = [];
  for (const j of order) {
    const hex = labToHex([C[j * 3], C[j * 3 + 1], C[j * 3 + 2]]);
    if (!out.includes(hex)) out.push(hex);
  }
  return out;
}
