/* ============================================================
   engine.test.ts — Vitest unit tests for the pure engine helpers
   (src/engine/engine.ts): stitch sequencing (incl. rotate/flip),
   flood fill, line/rect
   rasterization, working-area bbox math, and color contrast.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  buildSequence,
  stitchCount,
  completeRowPointer,
  uncompleteRowPointer,
  orientArea,
  orientPoint,
  orientCells,
  computeWorkingArea,
  fitCell,
  MIN_CELL,
  unionWithCells,
  contrastInk,
  isLight,
  floodFill,
  lineCells,
  rectCells,
  gridStroke,
} from "../src/engine/engine";
import type { Area, Rotation, WorldPoint } from "../src/types";

describe("buildSequence", () => {
  it("orders a 2x2 area in turned rows starting from the bottom row, left-to-right", () => {
    const seq = buildSequence({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(seq).toEqual([
      { x: 0, y: 1 }, // row 1 (bottom): left -> right
      { x: 1, y: 1 },
      { x: 1, y: 0 }, // row 2: right -> left
      { x: 0, y: 0 },
    ]);
  });

  it("alternates direction across three rows (boustrophedon)", () => {
    const seq = buildSequence({ x0: 0, y0: 0, x1: 2, y1: 2 });
    // row 1 (y=2): left->right, row 2 (y=1): right->left, row 3 (y=0): left->right
    expect(seq.map((p) => p.y)).toEqual([2, 2, 2, 1, 1, 1, 0, 0, 0]);
    expect(seq.slice(0, 3).map((p) => p.x)).toEqual([0, 1, 2]);
    expect(seq.slice(3, 6).map((p) => p.x)).toEqual([2, 1, 0]);
    expect(seq.slice(6, 9).map((p) => p.x)).toEqual([0, 1, 2]);
  });

  it("handles a single-row selection left-to-right", () => {
    const seq = buildSequence({ x0: 0, y0: 0, x1: 2, y1: 0 });
    expect(seq).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });
});

describe("buildSequence (flipped)", () => {
  it("starts row 1 at the bottom-right, running right-to-left, then turns", () => {
    const seq = buildSequence({ x0: 0, y0: 0, x1: 1, y1: 1 }, true);
    expect(seq).toEqual([
      { x: 1, y: 1 }, // row 1 (bottom): right -> left
      { x: 0, y: 1 },
      { x: 0, y: 0 }, // row 2: left -> right
      { x: 1, y: 0 },
    ]);
  });
});

describe("stitchCount", () => {
  it("counts the cells of an inclusive area", () => {
    expect(stitchCount({ x0: -1, y0: 2, x1: 2, y1: 3 })).toBe(8);
  });
});

describe("row completion pointers", () => {
  // 3 wide x 2 tall -> 6 stitches, rows start at pointer 0 and 3
  const sel = { x0: 4, y0: 1, x1: 6, y1: 2 };

  it("completeRowPointer jumps to the start of the next row", () => {
    expect(completeRowPointer(sel, 0)).toBe(3);
    expect(completeRowPointer(sel, 1)).toBe(3);
    expect(completeRowPointer(sel, 2)).toBe(3);
    expect(completeRowPointer(sel, 3)).toBe(6);
    expect(completeRowPointer(sel, 5)).toBe(6);
  });

  it("completeRowPointer stays at the end when the pattern is done", () => {
    expect(completeRowPointer(sel, 6)).toBe(6);
  });

  it("uncompleteRowPointer goes to the current row's start, or the previous one's at a boundary", () => {
    expect(uncompleteRowPointer(sel, 1)).toBe(0);
    expect(uncompleteRowPointer(sel, 2)).toBe(0);
    expect(uncompleteRowPointer(sel, 3)).toBe(0);
    expect(uncompleteRowPointer(sel, 4)).toBe(3);
    expect(uncompleteRowPointer(sel, 6)).toBe(3);
  });

  it("uncompleteRowPointer stays at 0 at the very start", () => {
    expect(uncompleteRowPointer(sel, 0)).toBe(0);
  });
});

describe("rotated stitching frame", () => {
  // 3 wide x 2 tall, away from the origin:
  //   A B C     (y = 5)
  //   D E F     (y = 6)
  const sel: Area = { x0: 4, y0: 5, x1: 6, y1: 6 };
  const cells = {
    "4,5": "A", "5,5": "B", "6,5": "C",
    "4,6": "D", "5,6": "E", "6,6": "F",
  };
  const ROTATIONS: Rotation[] = [0, 90, 180, 270];

  /** Frame rows top-to-bottom, as letters. */
  function rows(rotation: Rotation): string[] {
    const f = orientArea(sel, rotation);
    const fc = orientCells(cells, sel, rotation);
    const out: string[] = [];
    for (let y = f.y0; y <= f.y1; y++) {
      let row = "";
      for (let x = f.x0; x <= f.x1; x++) row += fc[`${x},${y}`] ?? ".";
      out.push(row);
    }
    return out;
  }

  it("keeps the frame anchored at the area's top-left, swapping width and height at 90/270", () => {
    expect(orientArea(sel, 0)).toEqual(sel);
    expect(orientArea(sel, 90)).toEqual({ x0: 4, y0: 5, x1: 5, y1: 7 });
    expect(orientArea(sel, 180)).toEqual(sel);
    expect(orientArea(sel, 270)).toEqual({ x0: 4, y0: 5, x1: 5, y1: 7 });
  });

  it("turns the cells clockwise", () => {
    expect(rows(0)).toEqual(["ABC", "DEF"]);
    expect(rows(90)).toEqual(["DA", "EB", "FC"]);
    expect(rows(180)).toEqual(["FED", "CBA"]);
    expect(rows(270)).toEqual(["CF", "BE", "AD"]);
  });

  it("ignores cells outside the area", () => {
    const fc = orientCells({ ...cells, "0,0": "Z" }, sel, 90);
    expect(Object.values(fc)).not.toContain("Z");
    expect(Object.keys(fc)).toHaveLength(6);
  });

  it("maps every cell of the area to a distinct frame cell", () => {
    for (const r of ROTATIONS) {
      const f = orientArea(sel, r);
      const seen = new Set<string>();
      for (let y = sel.y0; y <= sel.y1; y++) {
        for (let x = sel.x0; x <= sel.x1; x++) {
          const p = orientPoint(x, y, sel, r);
          expect(p.x).toBeGreaterThanOrEqual(f.x0);
          expect(p.x).toBeLessThanOrEqual(f.x1);
          expect(p.y).toBeGreaterThanOrEqual(f.y0);
          expect(p.y).toBeLessThanOrEqual(f.y1);
          seen.add(`${p.x},${p.y}`);
        }
      }
      expect(seen.size).toBe(stitchCount(sel));
    }
  });

  /** The stitch order for a rotation/flip, as letters of the original pattern. */
  function order(rotation: Rotation, flipped: boolean): string {
    const fc = orientCells(cells, sel, rotation);
    return buildSequence(orientArea(sel, rotation), flipped).map((p: WorldPoint) => fc[`${p.x},${p.y}`]).join("");
  }

  it("starts at the bottom-left of the board as shown, or bottom-right when flipped", () => {
    expect(order(0, false)).toBe("DEFCBA");  // bottom-left, along rows
    expect(order(0, true)).toBe("FEDABC");   // bottom-right, along rows
    expect(order(90, false)).toBe("FCBEDA"); // bottom-right, up columns
    expect(order(180, false)).toBe("CBADEF"); // top-right, along rows
    expect(order(270, false)).toBe("ADEBCF"); // top-left, down columns
  });

  it("gives 8 distinct stitch orders across rotate x flip", () => {
    const all = ROTATIONS.flatMap((r) => [order(r, false), order(r, true)]);
    expect(new Set(all).size).toBe(8);
    for (const o of all) expect([...o].sort().join("")).toBe("ABCDEF");
  });
});

describe("floodFill", () => {
  const working = { x0: 0, y0: 0, x1: 2, y1: 2 };

  it("returns null when there is no working area", () => {
    expect(floodFill({}, 1, 1, "#ff0000", "#ffffff", null)).toBeNull();
  });

  it("returns null when the new color matches the target color (no-op)", () => {
    expect(floodFill({}, 1, 1, "#ffffff", "#ffffff", working)).toBeNull();
  });

  it("fills the entire contiguous bg-colored region within the working area", () => {
    const result = floodFill({}, 1, 1, "#ff0000", "#ffffff", working);
    expect(result).not.toBeNull();
    const cells = result!;
    expect(Object.keys(cells)).toHaveLength(9); // 3x3 working area
    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x <= 2; x++) {
        expect(cells[`${x},${y}`]).toBe("#ff0000");
      }
    }
  });

  it("is bounded by the working area and stops at differently-colored cells", () => {
    // a vertical wall at x=1 splits the 3x3 working area into two columns
    const cells = { "1,0": "#000000", "1,1": "#000000", "1,2": "#000000" };
    const result = floodFill(cells, 0, 1, "#ff0000", "#ffffff", working);
    expect(result).not.toBeNull();
    const out = result!;
    // left column filled
    expect(out["0,0"]).toBe("#ff0000");
    expect(out["0,1"]).toBe("#ff0000");
    expect(out["0,2"]).toBe("#ff0000");
    // wall untouched
    expect(out["1,0"]).toBe("#000000");
    expect(out["1,1"]).toBe("#000000");
    expect(out["1,2"]).toBe("#000000");
    // right column not reached
    expect(out["2,0"]).toBeUndefined();
    expect(out["2,1"]).toBeUndefined();
    expect(out["2,2"]).toBeUndefined();
  });
});

describe("lineCells", () => {
  it("rasterizes a horizontal line including both endpoints", () => {
    expect(lineCells(0, 0, 3, 0)).toEqual([
      [0, 0], [1, 0], [2, 0], [3, 0],
    ]);
  });

  it("rasterizes a vertical line including both endpoints", () => {
    expect(lineCells(0, 0, 0, 3)).toEqual([
      [0, 0], [0, 1], [0, 2], [0, 3],
    ]);
  });

  it("rasterizes a 45-degree diagonal", () => {
    expect(lineCells(0, 0, 3, 3)).toEqual([
      [0, 0], [1, 1], [2, 2], [3, 3],
    ]);
  });

  it("works in reverse direction and a single-cell line", () => {
    expect(lineCells(3, 3, 0, 0)).toEqual([
      [3, 3], [2, 2], [1, 1], [0, 0],
    ]);
    expect(lineCells(2, 2, 2, 2)).toEqual([[2, 2]]);
  });
});

describe("rectCells", () => {
  it("returns all cells within the bounds, filled", () => {
    const pts = rectCells(0, 0, 2, 2);
    expect(pts).toHaveLength(9);
    expect(pts).toContainEqual([0, 0]);
    expect(pts).toContainEqual([2, 2]);
    expect(pts).toContainEqual([1, 1]);
  });

  it("normalizes bounds regardless of drag direction", () => {
    const forward = rectCells(0, 0, 2, 2);
    const reverse = rectCells(2, 2, 0, 0);
    const sortKey = (a: [number, number], b: [number, number]) =>
      a[0] - b[0] || a[1] - b[1];
    expect([...reverse].sort(sortKey)).toEqual([...forward].sort(sortKey));
  });

  it("returns a single cell for a zero-size rect", () => {
    expect(rectCells(1, 1, 1, 1)).toEqual([[1, 1]]);
  });
});

describe("computeWorkingArea", () => {
  it("returns null for an empty cells map", () => {
    expect(computeWorkingArea({})).toBeNull();
  });

  it("computes the bounding box of painted cells", () => {
    const cells = { "0,0": "#111", "2,3": "#222", "-1,1": "#333" };
    expect(computeWorkingArea(cells)).toEqual({ x0: -1, y0: 0, x1: 2, y1: 3 });
  });
});

describe("fitCell", () => {
  const area = { x0: -6, y0: -8, x1: 6, y1: 7 }; // 13x16 -> 15x18 with margin

  it("keeps the max cell size when the area already fits", () => {
    expect(fitCell(area, 1000, 800, 30)).toBe(30);
  });

  it("zooms out to the tighter axis, in whole pixels", () => {
    expect(fitCell(area, 375, 800, 30)).toBe(25); // 375 / 15 = 25
    expect(fitCell(area, 1000, 400, 30)).toBe(22); // 400 / 18 = 22.2
  });

  it("zooms out past the old 8px floor for large areas", () => {
    expect(fitCell(area, 90, 90, 30)).toBe(5); // 90 / 18 = 5
  });

  it("never goes below the MIN_CELL zoom floor", () => {
    expect(fitCell(area, 20, 20, 30)).toBe(MIN_CELL);
  });
});

describe("unionWithCells", () => {
  it("returns the existing area unchanged when no cell keys are given", () => {
    const area = { x0: 0, y0: 0, x1: 1, y1: 1 };
    expect(unionWithCells(area, [])).toBe(area);
    expect(unionWithCells(null, [])).toBeNull();
  });

  it("derives a new area from cell keys when there is no existing area", () => {
    expect(unionWithCells(null, ["1,1", "2,2"])).toEqual({ x0: 1, y0: 1, x1: 2, y1: 2 });
  });

  it("grows an existing area to include new cell keys", () => {
    const area = { x0: 0, y0: 0, x1: 1, y1: 1 };
    expect(unionWithCells(area, ["5,5"])).toEqual({ x0: 0, y0: 0, x1: 5, y1: 5 });
    // shrinking is never applied -- union only grows the box
    expect(unionWithCells(area, ["0,0"])).toEqual(area);
  });
});

describe("isLight / contrastInk", () => {
  it("treats white as light and black as dark", () => {
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#000000")).toBe(false);
  });

  it("picks a dark ink for light backgrounds and a light ink for dark backgrounds", () => {
    expect(contrastInk("#ffffff")).toBe("#2a2724");
    expect(contrastInk("#000000")).toBe("#fbf7f0");
  });
});

describe("gridStroke", () => {
  const rgb = (rgba: string) => rgba.match(/^rgba\((\d+),\s*(\d+),\s*(\d+)/)!.slice(1).map(Number);

  it("uses the dark ink on a light background", () => {
    expect(rgb(gridStroke("#f4efe3"))).toEqual([0x2a, 0x27, 0x24]);
  });

  it("uses the light ink on a dark background", () => {
    expect(rgb(gridStroke("#2e2b29"))).toEqual([0xfb, 0xf7, 0xf0]);
  });
});
