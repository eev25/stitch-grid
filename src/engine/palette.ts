/* ============================================================
   palette.ts — pure palette helpers (no React, no DOM).
   ============================================================ */
import type { Swatch } from "../types";

export interface PaletteState {
  bg: Swatch;
  palette: Swatch[];
  activeId: string;
}

/**
 * Make swatch `id` the background: the background and that swatch swap
 * color and label. The background keeps its id ("bg"); the swatch keeps
 * its id and position, so applying the swap again restores the original.
 * The active swatch follows its color. An unknown id is a no-op.
 */
export function swapWithBackground(bg: Swatch, palette: Swatch[], activeId: string, id: string): PaletteState {
  const target = palette.find((s) => s.id === id);
  if (!target) return { bg, palette, activeId };
  return {
    bg: { ...bg, color: target.color, label: target.label },
    palette: palette.map((s) => (s.id === id ? { ...s, color: bg.color, label: bg.label } : s)),
    activeId: activeId === id ? bg.id : activeId === bg.id ? id : activeId,
  };
}

/** Default label for the n-th color extracted from an uploaded image. */
export const imageColorLabel = (n: number): string => `Image color ${n}`;

/** Next free "Image color N" number: one past the highest already in `palette`. */
export function nextImageColorNumber(palette: Swatch[]): number {
  let max = 0;
  for (const s of palette) {
    const m = /^Image color (\d+)$/.exec(s.label);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}
