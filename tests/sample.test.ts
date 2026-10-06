/* ============================================================
   sample.test.ts — Vitest unit tests for the seeded sample motif
   and default yarn palette (src/engine/sample.ts).
   ============================================================ */
import { describe, it, expect } from "vitest";
import { DEFAULT_YARNS, sampleCells } from "../src/engine/sample";
import { computeWorkingArea } from "../src/engine/engine";

const colors = DEFAULT_YARNS.map((y) => y.color);

describe("sampleCells", () => {
  it("uses every default yarn color and nothing else", () => {
    const used = new Set(Object.values(sampleCells(colors)));
    expect([...used].sort()).toEqual([...colors].sort());
  });

  it("paints a 13x16 motif centered on the origin", () => {
    expect(computeWorkingArea(sampleCells(colors))).toEqual({ x0: -6, y0: -8, x1: 6, y1: 7 });
  });
});

describe("DEFAULT_YARNS", () => {
  it("has unique colors and labels, with Terracotta first", () => {
    expect(new Set(colors).size).toBe(DEFAULT_YARNS.length);
    expect(new Set(DEFAULT_YARNS.map((y) => y.label)).size).toBe(DEFAULT_YARNS.length);
    expect(DEFAULT_YARNS[0].label).toBe("Terracotta");
  });
});
