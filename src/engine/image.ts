/* ============================================================
   image.ts — pure helpers for an uploaded image attached to the
   working area: sizing/placement, aspect-locked resize, the
   image bar's on-screen position, and Pixelate (no React, no DOM).
   ============================================================ */
import type { Area, Cells, HandleDef, ImageSwatch, Swatch } from "../types";
import { ALPHA_MIN, SRGB_TO_LINEAR, hexToLab, linearToLab, nearestIndex, type PixelData } from "./color";
import { key } from "./engine";

/** An uploaded image always starts this many stitches wide. */
export const IMAGE_AREA_WIDTH = 40;
/** While an image is attached, neither side of the area may be shorter than this. */
export const IMAGE_MIN_SIDE = 4;
/** Opacity of the image drawn under the cells. */
export const IMAGE_OPACITY = 0.35;

/** Area size in whole cells for an image of aspect `w / h` at a given width. */
export function imageAreaSize(aspect: number, width = IMAGE_AREA_WIDTH): { w: number; h: number } {
  return {
    w: Math.max(IMAGE_MIN_SIDE, width),
    h: Math.max(IMAGE_MIN_SIDE, Math.round(width / aspect)),
  };
}

/** A w x h area whose center is as close as possible to world point (cx, cy). */
export function areaCenteredAt(cx: number, cy: number, w: number, h: number): Area {
  const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  return { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
}

export const moveArea = (a: Area, dx: number, dy: number): Area =>
  ({ x0: a.x0 + dx, y0: a.y0 + dy, x1: a.x1 + dx, y1: a.y1 + dy });

/**
 * Resize `rect` by dragging `handle` to world cell (cx, cy), keeping the
 * image's aspect ratio in whole cells. Corners follow whichever axis asks
 * for the bigger box and stay anchored at the opposite corner; edge handles
 * drive their own axis and keep the box centered on the other one. Neither
 * side goes below `minSide`.
 */
export function resizeAreaLocked(
  rect: Area, handle: HandleDef, cx: number, cy: number, aspect: number, minSide = IMAGE_MIN_SIDE,
): Area {
  let w: number | null = null, h: number | null = null;
  if (handle.ex === "max") w = cx - rect.x0 + 1;
  if (handle.ex === "min") w = rect.x1 - cx + 1;
  if (handle.ey === "max") h = cy - rect.y0 + 1;
  if (handle.ey === "min") h = rect.y1 - cy + 1;
  if (w !== null && h !== null) {
    if (w / aspect >= h) h = null; else w = null;
  }
  if (w !== null) h = Math.round(Math.max(1, w) / aspect);
  else w = Math.round(Math.max(1, h!) * aspect);
  w = Math.max(minSide, w);
  h = Math.max(minSide, h!);

  const out = { ...rect };
  if (handle.ex === "max") out.x1 = rect.x0 + w - 1;
  else if (handle.ex === "min") out.x0 = rect.x1 - w + 1;
  else { out.x0 = Math.round((rect.x0 + rect.x1 + 1) / 2 - w / 2); out.x1 = out.x0 + w - 1; }
  if (handle.ey === "max") out.y1 = rect.y0 + h - 1;
  else if (handle.ey === "min") out.y0 = rect.y1 - h + 1;
  else { out.y0 = Math.round((rect.y0 + rect.y1 + 1) / 2 - h / 2); out.y1 = out.y0 + h - 1; }
  return out;
}

/** Screen-space rectangle (CSS px, canvas-local). */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Position for the image bar: just above the box's top edge, left-aligned
 * with it; flipped below the box when there's no room above; clamped to the
 * viewport either way.
 */
export function placeBar(
  box: ScreenBox, bar: { w: number; h: number }, viewport: { w: number; h: number },
  gap = 8, margin = 8,
): { left: number; top: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const left = clamp(box.left, margin, viewport.w - bar.w - margin);
  const above = box.top - gap - bar.h;
  if (above >= margin) return { left, top: above };
  const below = box.bottom + gap;
  if (below + bar.h <= viewport.h - margin) return { left, top: below };
  return { left, top: clamp(above, margin, viewport.h - bar.h - margin) };
}

/** A color Pixelate matches against, and what it paints when that color wins. */
export interface PixelateTarget {
  /** Saved color the image region is matched against. */
  match: string;
  /** Color to paint, or null to clear the cell (the swatch was deleted). */
  paint: string | null;
}

/** Pair each image swatch's saved color with its current palette color (null if deleted). */
export function pixelateTargets(imageSwatches: ImageSwatch[], palette: Swatch[]): PixelateTarget[] {
  return imageSwatches.map((s) => ({
    match: s.color,
    paint: palette.find((p) => p.id === s.id)?.color ?? null,
  }));
}

/**
 * Pixelate: for every cell in `area`, box-filter average the opaque pixels of
 * the image region under it (in linear light), find the target whose `match`
 * color is nearest in CIELAB, and paint its `paint` color, or clear the cell
 * when that's null. Cells with no opaque pixels are cleared too. Cells
 * outside the area are untouched. Returns a new cells map.
 */
export function pixelateCells(cells: Cells, px: PixelData, area: Area, targets: PixelateTarget[]): Cells {
  const next: Cells = { ...cells };
  const labs = targets.map((t) => hexToLab(t.match));
  const cols = area.x1 - area.x0 + 1, rows = area.y1 - area.y0 + 1;
  const { data, width: W, height: H } = px;
  for (let cy = 0; cy < rows; cy++) {
    const py0 = Math.floor((cy * H) / rows);
    const py1 = Math.max(py0 + 1, Math.floor(((cy + 1) * H) / rows));
    for (let cx = 0; cx < cols; cx++) {
      const px0 = Math.floor((cx * W) / cols);
      const px1 = Math.max(px0 + 1, Math.floor(((cx + 1) * W) / cols));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = py0; y < py1; y++) {
        for (let x = px0; x < px1; x++) {
          const i = (y * W + x) * 4;
          if (data[i + 3] < ALPHA_MIN) continue;
          r += SRGB_TO_LINEAR[data[i]]; g += SRGB_TO_LINEAR[data[i + 1]]; b += SRGB_TO_LINEAR[data[i + 2]];
          n++;
        }
      }
      const k = key(area.x0 + cx, area.y0 + cy);
      const paint = n && labs.length ? targets[nearestIndex(linearToLab(r / n, g / n, b / n), labs)].paint : null;
      if (paint) next[k] = paint;
      else delete next[k];
    }
  }
  return next;
}
