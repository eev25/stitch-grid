/* ============================================================
   palette.test.ts — Vitest unit tests for the pure palette helpers
   (src/engine/palette.ts): swapping a swatch with the background.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { swapWithBackground } from "../src/engine/palette";
import type { Swatch } from "../src/types";

const bg: Swatch = { id: "bg", color: "#f4efe3", label: "Cream" };
const palette: Swatch[] = [
  { id: "c1", color: "#c8553d", label: "Terracotta" },
  { id: "c2", color: "#2e2b29", label: "Charcoal" },
  { id: "c3", color: "#3e5c76", label: "Denim" },
];

describe("swapWithBackground", () => {
  it("swaps color and label between the background and the swatch", () => {
    const r = swapWithBackground(bg, palette, "c1", "c2");
    expect(r.bg).toEqual({ id: "bg", color: "#2e2b29", label: "Charcoal" });
    expect(r.palette[1]).toEqual({ id: "c2", color: "#f4efe3", label: "Cream" });
  });

  it("keeps the swatch's id and position and leaves other swatches untouched", () => {
    const r = swapWithBackground(bg, palette, "c1", "c2");
    expect(r.palette.map((s) => s.id)).toEqual(["c1", "c2", "c3"]);
    expect(r.palette[0]).toBe(palette[0]);
    expect(r.palette[2]).toBe(palette[2]);
  });

  it("keeps the background id as \"bg\"", () => {
    expect(swapWithBackground(bg, palette, "c1", "c2").bg.id).toBe("bg");
  });

  it("moves the active swatch to the background when the swapped swatch was active", () => {
    expect(swapWithBackground(bg, palette, "c2", "c2").activeId).toBe("bg");
  });

  it("moves the active swatch to the swapped swatch when the background was active", () => {
    expect(swapWithBackground(bg, palette, "bg", "c2").activeId).toBe("c2");
  });

  it("leaves the active swatch alone when another swatch was active", () => {
    expect(swapWithBackground(bg, palette, "c3", "c2").activeId).toBe("c3");
  });

  it("restores the starting state when applied twice", () => {
    const once = swapWithBackground(bg, palette, "c2", "c2");
    const twice = swapWithBackground(once.bg, once.palette, once.activeId, "c2");
    expect(twice).toEqual({ bg, palette, activeId: "c2" });
  });

  it("is a no-op for an unknown id", () => {
    const r = swapWithBackground(bg, palette, "c1", "nope");
    expect(r.bg).toBe(bg);
    expect(r.palette).toBe(palette);
    expect(r.activeId).toBe("c1");
  });
});
