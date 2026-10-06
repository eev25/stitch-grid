/* ============================================================
   engine.ts — pure canvas drawing + math helpers
   Framework-agnostic: no React, no DOM globals beyond canvas/CSS.
   ============================================================ */

import type { Area, Cells, HandleDef, View, WorldPoint } from "../types";

export const key = (x: number, y: number): string => x + "," + y;

export const parseKey = (k: string): WorldPoint => {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
};

// ---- color helpers ----
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || "#000000").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export const isLight = (hex: string): boolean => luminance(hex) > 0.5;

export const contrastInk = (hex: string): string => (isLight(hex) ? "#2a2724" : "#fbf7f0");

/** Grid and origin-axis stroke colors: translucent contrast ink, so both stay visible on any background. */
export function gridStrokes(bg: string): { line: string; axis: string } {
  const { r, g, b } = hexToRgb(contrastInk(bg));
  return { line: `rgba(${r}, ${g}, ${b}, 0.13)`, axis: `rgba(${r}, ${g}, ${b}, 0.4)` };
}

// ---- working area (bbox of painted cells) ----
export function computeWorkingArea(cells: Cells): Area | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
  for (const k in cells) {
    const { x, y } = parseKey(k);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    n++;
  }
  if (n === 0) return null;
  return { x0: minX, y0: minY, x1: maxX, y1: maxY };
}

// Largest whole-px cell size (<= maxCell, >= 8) at which `area` plus a
// one-cell margin on every side fits a w x h canvas.
export function fitCell(area: Area, w: number, h: number, maxCell: number): number {
  const cols = area.x1 - area.x0 + 3;
  const rows = area.y1 - area.y0 + 3;
  return Math.max(8, Math.min(maxCell, Math.floor(Math.min(w / cols, h / rows))));
}

// ---- turned-row stitch sequence ----
// sel: {x0,y0,x1,y1} inclusive world cells. Row 1 = bottom (max y).
// odd rows (1st from bottom) left->right, even rows right->left.
export function buildSequence(sel: Area): WorldPoint[] {
  const seq: WorldPoint[] = [];
  const { x0, y0, x1, y1 } = sel;
  for (let r = y1; r >= y0; r--) {
    const fromBottom = y1 - r; // 0-based
    if (fromBottom % 2 === 0) {
      for (let c = x0; c <= x1; c++) seq.push({ x: c, y: r });
    } else {
      for (let c = x1; c >= x0; c--) seq.push({ x: c, y: r });
    }
  }
  return seq;
}

// ---- coordinate transform ----
// view = { panX, panY, cell }  (panX/panY = screen px of world origin)
export const worldToScreen = (wx: number, wy: number, v: View): { sx: number; sy: number } => ({
  sx: v.panX + wx * v.cell,
  sy: v.panY + wy * v.cell,
});

export const screenToWorld = (sx: number, sy: number, v: View): { wx: number; wy: number } => ({
  wx: Math.floor((sx - v.panX) / v.cell),
  wy: Math.floor((sy - v.panY) / v.cell),
});

export function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// ---- DESIGN canvas ----
export interface DrawDesignOptions {
  w: number;
  h: number;
  view: View;
  cells: Cells;
  bg: string;
  area: Area | null;
}

export function drawDesign(ctx: CanvasRenderingContext2D, o: DrawDesignOptions): void {
  const { w, h, view, cells, bg, area } = o;
  const v = view;
  ctx.clearRect(0, 0, w, h);

  // background fill
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // visible cell range
  const c0x = Math.floor((0 - v.panX) / v.cell);
  const c1x = Math.ceil((w - v.panX) / v.cell);
  const c0y = Math.floor((0 - v.panY) / v.cell);
  const c1y = Math.ceil((h - v.panY) / v.cell);

  // painted cells
  for (const k in cells) {
    const { x, y } = parseKey(k);
    if (x < c0x || x > c1x || y < c0y || y > c1y) continue;
    const { sx, sy } = worldToScreen(x, y, v);
    ctx.fillStyle = cells[k];
    ctx.fillRect(sx, sy, v.cell + 0.6, v.cell + 0.6);
  }

  // grid lines
  if (v.cell >= 5) {
    const strokes = gridStrokes(bg);
    ctx.lineWidth = 1;
    ctx.strokeStyle = strokes.line;
    ctx.beginPath();
    for (let x = c0x; x <= c1x + 1; x++) {
      const sx = Math.round(v.panX + x * v.cell) + 0.5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = c0y; y <= c1y + 1; y++) {
      const sy = Math.round(v.panY + y * v.cell) + 0.5;
      ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // origin emphasis lines
    ctx.lineWidth = 2;
    ctx.strokeStyle = strokes.axis;
    ctx.beginPath();
    const ox = Math.round(v.panX);
    const oy = Math.round(v.panY);
    if (ox > -2 && ox < w + 2) { ctx.moveTo(ox, 0); ctx.lineTo(ox, h); }
    if (oy > -2 && oy < h + 2) { ctx.moveTo(0, oy); ctx.lineTo(w, oy); }
    ctx.stroke();
  }

  // working-area box (always-on, resizable) — what Begin Stitching will use
  if (area) {
    drawArea(ctx, area, v);
  }
}

function drawArea(ctx: CanvasRenderingContext2D, sel: Area, v: View): void {
  const a = worldToScreen(sel.x0, sel.y0, v);
  const b = worldToScreen(sel.x1 + 1, sel.y1 + 1, v);
  const x = a.sx, y = a.sy, ww = b.sx - a.sx, hh = b.sy - a.sy;
  const accent = getCss("--accent");

  ctx.save();
  // very subtle fill so the region reads without tinting the art
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.05;
  ctx.fillRect(x, y, ww, hh);
  ctx.globalAlpha = 1;
  // dashed border
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = accent;
  ctx.strokeRect(x + 1, y + 1, ww - 2, hh - 2);
  ctx.setLineDash([]);
  // handles
  const hs = 10;
  const pts = handlePoints(x, y, ww, hh);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  for (const [px, py] of pts) {
    ctx.beginPath();
    ctx.rect(px - hs / 2, py - hs / 2, hs, hs);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function handlePoints(x: number, y: number, ww: number, hh: number): Array<[number, number]> {
  return [
    [x, y], [x + ww / 2, y], [x + ww, y],
    [x, y + hh / 2], [x + ww, y + hh / 2],
    [x, y + hh], [x + ww / 2, y + hh], [x + ww, y + hh],
  ];
}

// ---- STITCHING canvas ----
export interface DrawStitchingOptions {
  w: number;
  h: number;
  view: View;
  cells: Cells;
  bg: string;
  sel: Area;
  seq: WorldPoint[];
  pointer: number;
}

export function drawStitching(ctx: CanvasRenderingContext2D, o: DrawStitchingOptions): void {
  const { w, h, view, cells, bg, sel, seq, pointer } = o;
  const v = view;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getCss("--stitch-backdrop");
  ctx.fillRect(0, 0, w, h);

  const a = worldToScreen(sel.x0, sel.y0, v);
  const b = worldToScreen(sel.x1 + 1, sel.y1 + 1, v);

  // soft shadow under board
  ctx.save();
  ctx.shadowColor = "rgba(60,45,30,0.18)";
  ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.fillStyle = bg;
  roundRect(ctx, a.sx, a.sy, b.sx - a.sx, b.sy - a.sy, 4);
  ctx.fill();
  ctx.restore();

  // clip to board
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);
  ctx.clip();

  // background fill of board
  ctx.fillStyle = bg;
  ctx.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);

  // cells
  for (let y = sel.y0; y <= sel.y1; y++) {
    for (let x = sel.x0; x <= sel.x1; x++) {
      const col = cells[key(x, y)] || bg;
      const p = worldToScreen(x, y, v);
      if (cells[key(x, y)]) {
        ctx.fillStyle = col;
        ctx.fillRect(p.sx, p.sy, v.cell + 0.6, v.cell + 0.6);
      }
    }
  }

  // grid
  if (v.cell >= 5) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridStrokes(bg).line;
    ctx.beginPath();
    for (let x = sel.x0; x <= sel.x1 + 1; x++) {
      const sx = Math.round(v.panX + x * v.cell) + 0.5;
      ctx.moveTo(sx, a.sy); ctx.lineTo(sx, b.sy);
    }
    for (let y = sel.y0; y <= sel.y1 + 1; y++) {
      const sy = Math.round(v.panY + y * v.cell) + 0.5;
      ctx.moveTo(a.sx, sy); ctx.lineTo(b.sx, sy);
    }
    ctx.stroke();
  }

  // checkmarks for stitched
  for (let i = 0; i < pointer && i < seq.length; i++) {
    const { x, y } = seq[i];
    const col = cells[key(x, y)] || bg;
    const p = worldToScreen(x, y, v);
    drawCheck(ctx, p.sx, p.sy, v.cell, contrastInk(col));
  }

  ctx.restore(); // unclip

  // current stitch outline (drawn over clip edge ok)
  if (pointer < seq.length) {
    const { x, y } = seq[pointer];
    const p = worldToScreen(x, y, v);
    const col = cells[key(x, y)] || bg;
    ctx.save();
    // halo
    ctx.lineWidth = Math.max(3, v.cell * 0.14);
    ctx.strokeStyle = getCss("--accent");
    const inset = ctx.lineWidth / 2 + 0.5;
    ctx.strokeRect(p.sx + inset, p.sy + inset, v.cell - inset * 2, v.cell - inset * 2);
    // inner contrast ring
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isLight(col) ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.55)";
    ctx.strokeRect(p.sx + 1, p.sy + 1, v.cell - 2, v.cell - 2);
    ctx.restore();
  }
}

function drawCheck(ctx: CanvasRenderingContext2D, sx: number, sy: number, cell: number, color: string): void {
  const pad = cell * 0.26;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = Math.max(1.4, cell * 0.11);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx + pad, sy + cell * 0.54);
  ctx.lineTo(sx + cell * 0.43, sy + cell - pad);
  ctx.lineTo(sx + cell - pad * 0.85, sy + pad);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// read CSS var (resolved to rgb by browser)
const _cssCache: Record<string, string> = {};
export function getCss(name: string): string {
  if (_cssCache[name]) return _cssCache[name];
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  _cssCache[name] = v || "#999";
  return _cssCache[name];
}

// ---- flood fill bounded by working area ----
export function floodFill(
  cells: Cells,
  sx: number,
  sy: number,
  newColor: string,
  bg: string,
  working: Area | null,
): Cells | null {
  if (!working) return null;
  const targetCol = cells[key(sx, sy)] || bg;
  if (targetCol.toLowerCase() === newColor.toLowerCase()) return null;
  const out: Cells = { ...cells };
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [[sx, sy]];
  let changed = false;
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < working.x0 || x > working.x1 || y < working.y0 || y > working.y1) continue;
    const k = key(x, y);
    if (seen.has(k)) continue;
    seen.add(k);
    const col = cells[k] || bg;
    if (col.toLowerCase() !== targetCol.toLowerCase()) continue;
    out[k] = newColor;
    changed = true;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return changed ? out : null;
}

// filled rect: all cells inside bounds as [x,y] pairs
export function rectCells(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      pts.push([x, y]);
  return pts;
}

// bresenham line of cells
export function lineCells(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  while (true) {
    pts.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}

// handle hit-test on an area rect; returns handle index 0..7 or -1
export const HANDLE_DEFS: HandleDef[] = [
  { ex: "min", ey: "min" }, { ex: null, ey: "min" }, { ex: "max", ey: "min" },
  { ex: "min", ey: null }, { ex: "max", ey: null },
  { ex: "min", ey: "max" }, { ex: null, ey: "max" }, { ex: "max", ey: "max" },
];

export function hitAreaHandle(area: Area | null, px: number, py: number, v: View, radius?: number): number {
  if (!area) return -1;
  const a = worldToScreen(area.x0, area.y0, v);
  const b = worldToScreen(area.x1 + 1, area.y1 + 1, v);
  const pts = handlePoints(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i][0] - px, pts[i][1] - py) < (radius || 13)) return i;
  }
  return -1;
}

// union an area rect with a list of "x,y" cell keys
export function unionWithCells(area: Area | null, cellKeys: string[]): Area | null {
  if (!cellKeys.length) return area;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of cellKeys) {
    const { x, y } = parseKey(k);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!area) return { x0: minX, y0: minY, x1: maxX, y1: maxY };
  return {
    x0: Math.min(area.x0, minX), y0: Math.min(area.y0, minY),
    x1: Math.max(area.x1, maxX), y1: Math.max(area.y1, maxY),
  };
}
