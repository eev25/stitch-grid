/* ============================================================
   image.test.ts — Vitest unit tests for src/engine/image.ts:
   image area sizing/placement, aspect-locked resize, image bar
   placement, and Pixelate.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  areaCenteredAt, imageAreaSize, moveArea, pixelateCells, pixelateTargets, placeBar, resizeAreaLocked,
  type PixelateTarget,
} from "../src/engine/image";
import { HANDLE_DEFS } from "../src/engine/engine";
import { nextImageColorNumber } from "../src/engine/palette";
import type { PixelData } from "../src/engine/color";

// HANDLE_DEFS order: 0 TL, 1 T, 2 TR, 3 L, 4 R, 5 BL, 6 B, 7 BR
const [TL, , , , R, , B, BR] = HANDLE_DEFS;

describe("imageAreaSize", () => {
  it("is 40 wide with the height from the aspect ratio", () => {
    expect(imageAreaSize(4 / 3)).toEqual({ w: 40, h: 30 });
    expect(imageAreaSize(1 / 2)).toEqual({ w: 40, h: 80 });
  });

  it("keeps at least 4 cells on the short side", () => {
    expect(imageAreaSize(20)).toEqual({ w: 40, h: 4 });
  });
});

describe("areaCenteredAt / moveArea", () => {
  it("centers a w x h area on a world point", () => {
    expect(areaCenteredAt(0, 0, 40, 30)).toEqual({ x0: -20, y0: -15, x1: 19, y1: 14 });
  });

  it("moves by whole cells", () => {
    expect(moveArea({ x0: 0, y0: 0, x1: 3, y1: 3 }, 2, -1)).toEqual({ x0: 2, y0: -1, x1: 5, y1: 2 });
  });
});

describe("resizeAreaLocked", () => {
  const rect = { x0: 0, y0: 0, x1: 39, y1: 29 }; // 40 x 30, aspect 4:3

  it("scales from the bottom-right corner, anchored top-left", () => {
    expect(resizeAreaLocked(rect, BR, 19, 5, 4 / 3)).toEqual({ x0: 0, y0: 0, x1: 19, y1: 14 });
  });

  it("follows the axis that asks for the bigger box at a corner", () => {
    // pointer asks for 20 wide but 30 tall -> height wins: 40 x 30
    expect(resizeAreaLocked(rect, BR, 19, 29, 4 / 3)).toEqual(rect);
  });

  it("anchors the top-left corner handle at the bottom-right", () => {
    expect(resizeAreaLocked(rect, TL, 20, 15, 4 / 3)).toEqual({ x0: 20, y0: 15, x1: 39, y1: 29 });
  });

  it("keeps the other axis centered for edge handles", () => {
    expect(resizeAreaLocked(rect, R, 19, 99, 4 / 3)).toEqual({ x0: 0, y0: 8, x1: 19, y1: 22 });
    expect(resizeAreaLocked(rect, B, 99, 59, 4 / 3)).toEqual({ x0: -20, y0: 0, x1: 59, y1: 59 });
  });

  it("never goes below 4 cells on either side", () => {
    const r = resizeAreaLocked(rect, BR, -10, -10, 4 / 3);
    expect(r.x1 - r.x0 + 1).toBeGreaterThanOrEqual(4);
    expect(r.y1 - r.y0 + 1).toBe(4);
  });
});

describe("placeBar", () => {
  const vp = { w: 800, h: 600 };
  const bar = { w: 200, h: 40 };

  it("sits just above the box, left-aligned", () => {
    expect(placeBar({ left: 100, top: 200, right: 500, bottom: 400 }, bar, vp)).toEqual({ left: 100, top: 152 });
  });

  it("flips below when there's no room above", () => {
    expect(placeBar({ left: 100, top: 20, right: 500, bottom: 400 }, bar, vp)).toEqual({ left: 100, top: 408 });
  });

  it("clamps to the viewport", () => {
    expect(placeBar({ left: -300, top: 200, right: 100, bottom: 400 }, bar, vp).left).toBe(8);
    expect(placeBar({ left: 700, top: 200, right: 900, bottom: 400 }, bar, vp).left).toBe(592);
    expect(placeBar({ left: 0, top: -100, right: 800, bottom: 900 }, bar, vp).top).toBe(8);
  });
});

describe("pixelateCells", () => {
  // 4x2 image: left half red, right half blue; bottom-right pixel transparent.
  function img(): PixelData {
    const d: number[] = [];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) {
      const transparent = x === 3 && y === 1;
      d.push(...(x < 2 ? [250, 10, 10] : [10, 10, 250]), transparent ? 0 : 255);
    }
    return { data: Uint8ClampedArray.from(d), width: 4, height: 2 };
  }
  const area = { x0: 10, y0: 10, x1: 11, y1: 10 }; // 2 x 1 cells
  // Swatches unchanged since the image was added: paint what you match.
  const same = (...colors: string[]): PixelateTarget[] => colors.map((c) => ({ match: c, paint: c }));

  it("paints each cell with the nearest extracted color", () => {
    const out = pixelateCells({}, img(), area, same("#ff0000", "#0000ff"));
    expect(out).toEqual({ "10,10": "#ff0000", "11,10": "#0000ff" });
  });

  it("overwrites cells in the area and leaves cells outside alone", () => {
    const out = pixelateCells({ "10,10": "#00ff00", "0,0": "#00ff00" }, img(), area, same("#ff0000", "#0000ff"));
    expect(out["10,10"]).toBe("#ff0000");
    expect(out["0,0"]).toBe("#00ff00");
  });

  it("clears cells with no opaque pixels under them", () => {
    const tall = { x0: 0, y0: 0, x1: 3, y1: 1 }; // 1 pixel per cell
    const out = pixelateCells({ "3,1": "#00ff00" }, img(), tall, same("#ff0000", "#0000ff"));
    expect(out["3,1"]).toBeUndefined();
    expect(out["3,0"]).toBe("#0000ff");
  });

  it("works when the area has more cells than the image has pixels", () => {
    const big = { x0: 0, y0: 0, x1: 7, y1: 3 };
    const out = pixelateCells({}, img(), big, same("#ff0000", "#0000ff"));
    expect(out["0,0"]).toBe("#ff0000");
    expect(out["7,0"]).toBe("#0000ff");
    expect(Object.keys(out)).toHaveLength(28); // 32 cells minus the 2x2 over the transparent pixel
  });

  it("matches on the saved color but paints the swatch's current color", () => {
    // the red swatch was edited to green: the red region is painted green
    const out = pixelateCells({}, img(), area, [
      { match: "#ff0000", paint: "#00ff00" },
      { match: "#0000ff", paint: "#0000ff" },
    ]);
    expect(out).toEqual({ "10,10": "#00ff00", "11,10": "#0000ff" });
  });

  it("clears cells whose nearest swatch was deleted, instead of using the next nearest", () => {
    const out = pixelateCells({ "10,10": "#123456" }, img(), area, [
      { match: "#ff0000", paint: null },
      { match: "#0000ff", paint: "#0000ff" },
    ]);
    expect(out).toEqual({ "11,10": "#0000ff" });
  });
});

describe("pixelateTargets", () => {
  it("pairs saved colors with current palette colors, null for deleted swatches", () => {
    const palette = [
      { id: "a", color: "#00ff00", label: "Image color 1" }, // edited since upload
      { id: "x", color: "#999999", label: "Other" },
    ];
    expect(pixelateTargets([{ id: "a", color: "#ff0000" }, { id: "b", color: "#0000ff" }], palette)).toEqual([
      { match: "#ff0000", paint: "#00ff00" },
      { match: "#0000ff", paint: null },
    ]);
  });
});

describe("nextImageColorNumber", () => {
  it("continues after the highest existing Image color N", () => {
    expect(nextImageColorNumber([])).toBe(1);
    expect(nextImageColorNumber([
      { id: "a", color: "#000000", label: "Image color 2" },
      { id: "b", color: "#000000", label: "Image color 7" },
      { id: "c", color: "#000000", label: "Image color x" },
    ])).toBe(8);
  });
});
