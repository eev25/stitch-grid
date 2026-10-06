/* ============================================================
   useDesignCanvas — Design View canvas surface: sizing, redraw,
   pan/zoom (wheel + two-finger touch), and pointer handling for
   pencil/eraser/bucket/line/rect tools + working-area resize.
   ============================================================ */
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type Dispatch, type RefObject, type SetStateAction,
} from "react";
import * as E from "../engine/engine";
import { isTouchEvent, localPt, pinchDist, type CanvasPointerEvent } from "./canvasPointer";
import type { Area, Cells, HandleDef, Swatch, Tool, TopView, View, WorldPoint } from "../types";

export type { CanvasPointerEvent } from "./canvasPointer";

export interface DimBadge {
  left: number;
  top: number;
  text: string;
}

interface UseDesignCanvasOptions {
  cells: Cells;
  setCells: Dispatch<SetStateAction<Cells>>;
  bg: Swatch;
  area: Area | null;
  setArea: Dispatch<SetStateAction<Area | null>>;
  activeColor: string;
  tool: Tool;
  topView: TopView;
  pushHistory: (prevCells: Cells) => void;
  commitCells: (prevCells: Cells, nextCells: Cells) => void;
  /** Zoom out (never in) on first layout so the initial working area fits. */
  fitOnLoad?: boolean;
}

export interface DesignCanvasApi {
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: CanvasPointerEvent) => void;
  onPointerMove: (e: CanvasPointerEvent) => void;
  onPointerUp: () => void;
  zoom: (dir: number) => void;
  home: () => void;
  recenter: () => void;
  dimBadge: DimBadge | null;
  resizing: boolean;
  isTouch: boolean;
}

type DragState =
  | { type: "pinch"; d: number; x: number; y: number; cell: number; panX: number; panY: number }
  | { type: "resize"; handle: HandleDef; rect: Area }
  | { type: "line" | "rect"; start: WorldPoint; prev: Cells; map: Cells }
  | { type: "paint"; erase: boolean; last: WorldPoint; prev: Cells; map: Cells; touched: string[] };

function worldCell(p: { x: number; y: number }, v: View): WorldPoint {
  return { x: Math.floor((p.x - v.panX) / v.cell), y: Math.floor((p.y - v.panY) / v.cell) };
}

function paintAt(map: Cells, x: number, y: number, erase: boolean, color: string): void {
  const k = E.key(x, y);
  if (erase) delete map[k];
  else map[k] = color;
}

export function useDesignCanvas(opts: UseDesignCanvasOptions): DesignCanvasApi {
  const { cells, setCells, bg, area, setArea, activeColor, tool, topView, pushHistory, commitCells, fitOnLoad } = opts;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ panX: 0, panY: 0, cell: 30 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const drag = useRef<DragState | null>(null);
  // initial working area to frame on first layout (captured once at mount)
  const fitAreaRef = useRef(fitOnLoad ? area : null);

  // viewTick forces a re-render after viewRef (pan/zoom) mutations that
  // don't otherwise change React state, so derived UI (e.g. dimBadge) refreshes.
  const [viewTick, setViewTick] = useState(0);
  const [resizing, setResizing] = useState(false);
  const isTouch = useRef(typeof window !== "undefined" && "ontouchstart" in window).current;

  // ---------- drawing ----------
  const redraw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const ctx = E.setupCanvas(cv, w, h);
    E.drawDesign(ctx, { w, h, view: viewRef.current, cells, bg: bg.color, area });
  }, [cells, bg.color, area]);

  // Center the view on a world-cell rect at the current zoom.
  const centerViewOn = useCallback((rect: Area) => {
    const v = viewRef.current; const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const cx = (rect.x0 + rect.x1 + 1) / 2;
    const cy = (rect.y0 + rect.y1 + 1) / 2;
    v.panX = w / 2 - cx * v.cell;
    v.panY = h / 2 - cy * v.cell;
  }, []);

  const measure = useCallback(() => {
    const el = wrapRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const first = sizeRef.current.w === 0;
    sizeRef.current = { w: r.width, h: r.height };
    if (first) {
      const v = viewRef.current;
      const fit = fitAreaRef.current;
      if (fit) {
        v.cell = E.fitCell(fit, r.width, r.height, v.cell);
        centerViewOn(fit);
      } else {
        v.panX = r.width / 2; v.panY = r.height / 2;
      }
    }
    redraw(); setViewTick((t) => t + 1);
  }, [redraw, centerViewOn]);

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure));
    // self-healing poll: ResizeObserver's initial callback is unreliable in
    // sandboxed iframes and layout may resolve late — retry until sized.
    const poll = setInterval(() => {
      if (sizeRef.current.w > 0) { clearInterval(poll); return; }
      measure();
    }, 80);
    const stopPoll = setTimeout(() => clearInterval(poll), 4000);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf1); cancelAnimationFrame(raf2);
      clearInterval(poll); clearTimeout(stopPoll);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => { redraw(); }, [redraw, topView]);

  // Keep a ref to the latest redraw so the wheel handler (registered once
  // per canvas node) always calls the fresh closure.
  const redrawRef = useRef(redraw);
  useEffect(() => { redrawRef.current = redraw; }, [redraw]);

  // Trackpad / mouse-wheel: two-finger scroll -> pan; Ctrl/Meta + scroll -> zoom.
  // Depend on topView so the listener re-registers on the new canvas node after
  // exiting Stitching Mode (the design canvas is unmounted/remounted on view switch).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el!.getBoundingClientRect();
        const px = e.clientX - r.left; const py = e.clientY - r.top;
        const cx = (px - v.panX) / v.cell; const cy = (py - v.panY) / v.cell;
        const factor = e.deltaY < 0 ? 1.05 : 0.95;
        v.cell = Math.max(8, Math.min(72, v.cell * factor));
        v.panX = px - cx * v.cell; v.panY = py - cy * v.cell;
      } else {
        v.panX -= e.deltaX; v.panY -= e.deltaY;
      }
      redrawRef.current(); setViewTick((t) => t + 1);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [topView]);

  // ---------- view ops ----------
  const zoom = useCallback((dir: number) => {
    const v = viewRef.current; const { w, h } = sizeRef.current;
    const cx = (w / 2 - v.panX) / v.cell, cy = (h / 2 - v.panY) / v.cell;
    v.cell = Math.max(8, Math.min(72, v.cell * (dir > 0 ? 1.25 : 0.8)));
    v.panX = w / 2 - cx * v.cell; v.panY = h / 2 - cy * v.cell;
    redraw(); setViewTick((t) => t + 1);
  }, [redraw]);

  const home = useCallback(() => {
    const v = viewRef.current; const { w, h } = sizeRef.current;
    v.panX = w / 2; v.panY = h / 2;
    redraw(); setViewTick((t) => t + 1);
  }, [redraw]);

  // Recenter: frame the working area, or origin if none.
  const recenter = useCallback(() => {
    if (area) centerViewOn(area);
    else { const v = viewRef.current; const { w, h } = sizeRef.current; v.panX = w / 2; v.panY = h / 2; }
    redraw(); setViewTick((t) => t + 1);
  }, [area, centerViewOn, redraw]);

  // ---------- working-area handle hit testing ----------
  const hitHandle = useCallback((rect: Area, p: { x: number; y: number }) => {
    return E.hitAreaHandle(rect, p.x, p.y, viewRef.current, 13);
  }, []);

  // ============================================================
  // DESIGN canvas pointer events
  // ============================================================
  const onPointerDown = useCallback((e: CanvasPointerEvent) => {
    if ("button" in e && e.button === 1) return;
    const canvas = canvasRef.current; if (!canvas) return;

    // Two-finger touch -> pan + pinch-zoom in any mode.
    if (isTouchEvent(e) && e.touches.length >= 2) {
      // The first finger already started a stroke/resize; discard it so the
      // gesture doesn't leave a stray cell behind.
      const d = drag.current;
      if (d && (d.type === "paint" || d.type === "line" || d.type === "rect")) setCells(d.prev);
      if (d && d.type === "resize") { setArea(d.rect); setResizing(false); }
      const r = canvas.getBoundingClientRect();
      const t0 = e.touches[0], t1 = e.touches[1];
      const mx = (t0.clientX + t1.clientX) / 2 - r.left;
      const my = (t0.clientY + t1.clientY) / 2 - r.top;
      const v = viewRef.current;
      drag.current = { type: "pinch", d: pinchDist(e), x: mx, y: my, cell: v.cell, panX: v.panX, panY: v.panY };
      return;
    }
    const p = localPt(e, canvas);

    // The working-area box is resizable at ANY time (any mode).
    if (area) {
      const hi = hitHandle(area, p);
      if (hi >= 0) {
        drag.current = { type: "resize", handle: E.HANDLE_DEFS[hi], rect: { ...area } };
        setResizing(true);
        return;
      }
    }

    // paint
    const c = worldCell(p, viewRef.current);
    if (tool === "bucket") {
      if (!area) { // nothing to bound: just paint single cell
        const prev = cells; const next = { ...cells };
        paintAt(next, c.x, c.y, false, activeColor);
        commitCells(prev, next);
        setArea((a) => E.unionWithCells(a, [E.key(c.x, c.y)]));
        return;
      }
      const next = E.floodFill(cells, c.x, c.y, activeColor, bg.color, area);
      if (next) {
        commitCells(cells, next);
        const touched = Object.keys(next).filter((k) => next[k] !== cells[k]);
        setArea((a) => E.unionWithCells(a, touched));
      }
      return;
    }
    // line / rect shape tools
    if (tool === "line" || tool === "rect") {
      const map = { ...cells, [E.key(c.x, c.y)]: activeColor };
      drag.current = { type: tool, start: c, prev: cells, map };
      setCells(map);
      return;
    }
    // pencil / eraser stroke
    const erase = tool === "eraser";
    const map = { ...cells };
    const touched: string[] = [];
    paintAt(map, c.x, c.y, erase, activeColor);
    if (!erase) touched.push(E.key(c.x, c.y));
    drag.current = { type: "paint", erase, last: c, prev: cells, map, touched };
    setCells(map);
  }, [area, activeColor, bg.color, cells, commitCells, hitHandle, setArea, setCells, tool]);

  const onPointerMove = useCallback((e: CanvasPointerEvent) => {
    const d = drag.current; if (!d) return;
    const canvas = canvasRef.current; if (!canvas) return;

    if (d.type === "pinch") {
      if (!isTouchEvent(e) || e.touches.length < 2) return;
      const r = canvas.getBoundingClientRect();
      const t0 = e.touches[0], t1 = e.touches[1];
      const mx = (t0.clientX + t1.clientX) / 2 - r.left;
      const my = (t0.clientY + t1.clientY) / 2 - r.top;
      const v = viewRef.current;
      // world point under the gesture's start midpoint stays pinned to the live midpoint
      const cx = (d.x - d.panX) / d.cell, cy = (d.y - d.panY) / d.cell;
      v.cell = Math.max(8, Math.min(72, d.cell * (pinchDist(e) / d.d)));
      v.panX = mx - cx * v.cell;
      v.panY = my - cy * v.cell;
      redraw(); setViewTick((t) => t + 1);
      return;
    }
    const p = localPt(e, canvas);

    if (d.type === "paint") {
      const c = worldCell(p, viewRef.current);
      if (c.x === d.last.x && c.y === d.last.y) return;
      const pts = E.lineCells(d.last.x, d.last.y, c.x, c.y);
      for (const [x, y] of pts) {
        paintAt(d.map, x, y, d.erase, activeColor);
        if (!d.erase) d.touched.push(E.key(x, y));
      }
      d.last = c;
      setCells({ ...d.map });
      return;
    }
    if (d.type === "line") {
      const c = worldCell(p, viewRef.current);
      const pts = E.lineCells(d.start.x, d.start.y, c.x, c.y);
      const map = { ...d.prev };
      for (const [x, y] of pts) map[E.key(x, y)] = activeColor;
      d.map = map;
      setCells(map);
      return;
    }
    if (d.type === "rect") {
      const c = worldCell(p, viewRef.current);
      const pts = E.rectCells(d.start.x, d.start.y, c.x, c.y);
      const map = { ...d.prev };
      for (const [x, y] of pts) map[E.key(x, y)] = activeColor;
      d.map = map;
      setCells(map);
      return;
    }
    if (d.type === "resize") {
      const v = viewRef.current;
      const cx = Math.floor((p.x - v.panX) / v.cell);
      const cy = Math.floor((p.y - v.panY) / v.cell);
      const s = { ...d.rect };
      if (d.handle.ex === "min") s.x0 = Math.min(cx, d.rect.x1);
      if (d.handle.ex === "max") s.x1 = Math.max(cx, d.rect.x0);
      if (d.handle.ey === "min") s.y0 = Math.min(cy, d.rect.y1);
      if (d.handle.ey === "max") s.y1 = Math.max(cy, d.rect.y0);
      setArea(s);
      return;
    }
  }, [activeColor, redraw, setArea, setCells]);

  const onPointerUp = useCallback(() => {
    const d = drag.current; drag.current = null;
    canvasRef.current?.classList.remove("panning");
    if (d && d.type === "resize") setResizing(false);
    if (!d) return;
    if (d.type === "line" || d.type === "rect") {
      const changed = JSON.stringify(d.prev) !== JSON.stringify(d.map);
      if (changed) {
        pushHistory(d.prev);
        const touched = Object.keys(d.map).filter((k) => d.map[k] !== d.prev[k]);
        if (touched.length) setArea((a) => E.unionWithCells(a, touched));
      }
    }
    if (d.type === "paint") {
      const changed = JSON.stringify(d.prev) !== JSON.stringify(d.map);
      if (changed) {
        pushHistory(d.prev);
        // auto-grow the working area to include newly painted cells
        if (d.touched.length) setArea((a) => E.unionWithCells(a, d.touched));
      }
    }
  }, [pushHistory, setArea]);

  // ---------- overlay geometry ----------
  // dimension readout sits on the working-area box (shown while resizing).
  // Depends on viewTick too: a pan/zoom can move the badge's screen position
  // even when `area` itself hasn't changed.
  const dimBadge = useMemo<DimBadge | null>(() => {
    if (!area) return null;
    const v = viewRef.current;
    const a = E.worldToScreen(area.x0, area.y0, v);
    const b = E.worldToScreen(area.x1 + 1, area.y1 + 1, v);
    const cx = (a.sx + b.sx) / 2;
    const w = area.x1 - area.x0 + 1;
    const h = area.y1 - area.y0 + 1;
    return { left: cx, top: a.sy - 16, text: `${w} × ${h} stitches` };
  }, [area, viewTick]);

  return {
    wrapRef, canvasRef,
    onPointerDown, onPointerMove, onPointerUp,
    zoom, home, recenter,
    dimBadge, resizing, isTouch,
  };
}
