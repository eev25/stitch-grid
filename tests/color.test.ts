/* ============================================================
   color.test.ts — Vitest unit tests for src/engine/color.ts:
   CIELAB round-trips, nearest-color matching, and deterministic
   k-means palette extraction.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { extractPalette, hexToLab, labToHex, nearestIndex, type PixelData } from "../src/engine/color";
import { hexToRgb } from "../src/engine/engine";

/** Build RGBA pixels from a list of [hex, alpha, count] runs. */
function pixels(runs: Array<[string, number, number]>): PixelData {
  const out: number[] = [];
  for (const [hex, a, n] of runs) {
    const { r, g, b } = hexToRgb(hex);
    for (let i = 0; i < n; i++) out.push(r, g, b, a);
  }
  return { data: Uint8ClampedArray.from(out), width: out.length / 4, height: 1 };
}

describe("CIELAB conversion", () => {
  it("round-trips sRGB hex colors", () => {
    for (const hex of ["#000000", "#ffffff", "#c8553d", "#3e5c76", "#e0a526", "#808080"]) {
      expect(labToHex(hexToLab(hex))).toBe(hex);
    }
  });

  it("maps white to L=100 and black to L=0 with neutral a/b", () => {
    const w = hexToLab("#ffffff");
    expect(w[0]).toBeCloseTo(100, 1);
    expect(Math.abs(w[1])).toBeLessThan(0.01);
    expect(Math.abs(w[2])).toBeLessThan(0.01);
    expect(hexToLab("#000000")[0]).toBeCloseTo(0, 5);
  });
});

describe("nearestIndex", () => {
  it("picks the perceptually closest color", () => {
    const labs = ["#000000", "#ffffff", "#ff0000"].map(hexToLab);
    expect(nearestIndex(hexToLab("#e01010"), labs)).toBe(2);
    expect(nearestIndex(hexToLab("#202020"), labs)).toBe(0);
    expect(nearestIndex(hexToLab("#f0f0f0"), labs)).toBe(1);
  });

  it("returns -1 for an empty palette", () => {
    expect(nearestIndex(hexToLab("#123456"), [])).toBe(-1);
  });
});

describe("extractPalette", () => {
  const img = pixels([["#ff0000", 255, 60], ["#0000ff", 255, 30], ["#00ff00", 255, 10]]);

  it("finds the distinct colors, most common first", () => {
    expect(extractPalette(img, 3)).toEqual(["#ff0000", "#0000ff", "#00ff00"]);
  });

  it("is deterministic for the same input", () => {
    const noisy: PixelData = { data: new Uint8ClampedArray(400 * 4), width: 400, height: 1 };
    for (let i = 0; i < 400; i++) {
      noisy.data.set([(i * 37) % 256, (i * 91) % 256, (i * 13) % 256, 255], i * 4);
    }
    const a = extractPalette(noisy, 5);
    expect(a).toHaveLength(5);
    expect(extractPalette(noisy, 5)).toEqual(a);
  });

  it("ignores pixels with alpha below 50%", () => {
    const withAlpha = pixels([["#ff0000", 255, 10], ["#00ff00", 127, 500], ["#0000ff", 128, 10]]);
    expect(extractPalette(withAlpha, 3).sort()).toEqual(["#0000ff", "#ff0000"]);
  });

  it("returns fewer colors than k when the image has fewer distinct colors", () => {
    expect(extractPalette(pixels([["#123456", 255, 20]]), 4)).toEqual(["#123456"]);
  });

  it("returns nothing for a fully transparent image", () => {
    expect(extractPalette(pixels([["#123456", 0, 20]]), 4)).toEqual([]);
  });

  it("merges colors into k clusters", () => {
    const two = extractPalette(pixels([["#ff0000", 255, 10], ["#f00000", 255, 10], ["#0000ff", 255, 10]]), 2);
    expect(two).toHaveLength(2);
    expect(two).toContain("#0000ff");
  });
});
