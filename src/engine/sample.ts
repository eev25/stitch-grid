/* ============================================================
   sample.ts — default yarn palette and the seeded sample motif
   shown on a first visit (pure: no React, no DOM).
   ============================================================ */
import type { Cells } from "../types";
import { key } from "./engine";

/** Default yarns, in palette order (the first is active on load). */
export const DEFAULT_YARNS: ReadonlyArray<{ color: string; label: string }> = [
  { color: "#c8553d", label: "Terracotta" },
  { color: "#d9788a", label: "Rose" },
  { color: "#e0a526", label: "Mustard" },
  { color: "#3e5c76", label: "Denim" },
  { color: "#6e8b5b", label: "Sage" },
  { color: "#3b5240", label: "Forest" },
  { color: "#2e2b29", label: "Charcoal" },
];

// Potted flower (13x16). Each letter is an index into the palette;
// "." is left unpainted so the background shows through.
const MOTIF = [
  "..BBB........",
  ".BBYBB..PPP..",
  ".BYYYB.PPYPP.",
  ".BBYBB.PYYYP.",
  "..BBB..PPYPP.",
  "...G....PPP..",
  "FF.G.....G...",
  "FGGG.....G.FF",
  ".FF.G....GGGF",
  ".....G..G....",
  "......GG.....",
  "...KKKKKKK...",
  "..TTTTTTTTT..",
  "...TTTTTTT...",
  "...TTTTTTT...",
  "....TTTTT....",
];
const INK: Record<string, number> = { T: 0, P: 1, Y: 2, B: 3, G: 4, F: 5, K: 6 };

/** Paint the sample motif, centered on the origin, from `colors` (palette order). */
export function sampleCells(colors: string[]): Cells {
  const ox = Math.floor(MOTIF[0].length / 2);
  const oy = Math.floor(MOTIF.length / 2);
  const cells: Cells = {};
  MOTIF.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch in INK) cells[key(c - ox, r - oy)] = colors[INK[ch]];
    });
  });
  return cells;
}
