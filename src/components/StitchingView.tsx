/* ============================================================
   StitchingView — Stitching Mode: bounded canvas with guided
   turned-row Next/Undo controls, and rotate / flip-row-direction
   buttons that change where the stitch order starts.
   ============================================================ */
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import * as E from "../engine/engine";
import * as Icons from "../icons/icons";
import { isTouchEvent, localPt, pinchDist, type CanvasPointerEvent } from "../hooks/canvasPointer";
import { useHoldRepeat } from "../hooks/useHoldRepeat";
import type { Area, Cells, Reorder, Rotation, View, WorldPoint } from "../types";
import controls from "../styles/controls.module.css";
import styles from "./Stitching.module.css";

export interface StitchingViewProps {
  /** Board area, cells, and stitch order, all in the rotated frame. */
  sel: Area;
  seq: WorldPoint[];
  pointer: number;
  cells: Cells;
  bg: string;
  rotation: Rotation;
  flipped: boolean;
  onNext: () => void;
  onUndo: () => void;
  onSkip: () => void;
  onCompleteRow: () => void;
  onUncompleteRow: () => void;
  onExit: () => void;
  onReorder: (change: Reorder) => void;
}

/** CSS custom-property style object (for --next-bg / --next-fg tinting). */
type CSSVars = CSSProperties & { [key: `--${string}`]: string | number };

type StitchDragState =
  | { type: "pan"; x: number; y: number; panX: number; panY: number }
  | { type: "pinch"; d: number; x: number; y: number; cell: number; panX: number; panY: number };

export function StitchingView(props: StitchingViewProps) {
  const { sel, seq, pointer, cells, bg, rotation, flipped, onNext, onUndo, onSkip, onCompleteRow, onUncompleteRow, onExit, onReorder } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ panX: 0, panY: 0, cell: 34 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const drag = useRef<StitchDragState | null>(null);

  const redraw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const ctx = E.setupCanvas(cv, w, h);
    E.drawStitching(ctx, { w, h, view: viewRef.current, cells, bg, sel, seq, pointer });
  }, [cells, bg, sel, seq, pointer]);

  // center the view on a given stitch index; `fit` also picks a cell size
  // that frames the whole selection.
  const centerOn = useCallback((idx: number, fit: boolean) => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const v = viewRef.current;
    if (fit) {
      const cols = sel.x1 - sel.x0 + 1, rows = sel.y1 - sel.y0 + 1;
      const cell = Math.max(10, Math.min(46, Math.floor(Math.min((w - 80) / cols, (h - 80) / rows))));
      v.cell = cell;
    }
    const s = seq[Math.min(idx, seq.length - 1)] || seq[0];
    if (!s) return;
    const cx = (s.x + 0.5) * v.cell;
    const cy = (s.y + 0.5) * v.cell;
    v.panX = w / 2 - cx;
    v.panY = h / 2 - cy;
  }, [sel, seq]);

  // smart recenter: only move if the current stitch would be off-screen
  const ensureVisible = useCallback((idx: number) => {
    const { w, h } = sizeRef.current;
    const v = viewRef.current;
    const s = seq[Math.min(idx, seq.length - 1)]; if (!s) return;
    const sx = v.panX + s.x * v.cell;
    const sy = v.panY + s.y * v.cell;
    const m = 24;
    const off = sx < m || sy < m || sx + v.cell > w - m || sy + v.cell > h - m;
    if (off) centerOn(idx, false);
  }, [seq, centerOn]);

  // size tracking
  // Measure the canvas (not its wrapper) so sizing shares one box with
  // pointer mapping, which reads the canvas rect.
  const measure = useCallback(() => {
    const el = canvasRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const first = sizeRef.current.w === 0;
    sizeRef.current = { w: r.width, h: r.height };
    if (first) centerOn(pointer, true);
    redraw();
  }, [centerOn, pointer, redraw]);

  // Run the sizing setup once on mount: the `first`-measurement guard above
  // only matters at mount time, and ongoing redraws are handled by the
  // `redraw()` effect below — re-running this on every pointer/cell change
  // would needlessly tear down and recreate the ResizeObserver each click.
  useLayoutEffect(() => {
    const el = canvasRef.current; if (!el) return;
    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure));
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
  }, []);

  // recenter when the stitch pointer changes
  const prevPointer = useRef(pointer);

  // After a rotate/flip, reframe like Home: the new board shape, centered on
  // the (new) current stitch. This also covers the pointer reset to 0.
  const orientation = `${rotation}:${flipped}`;
  const prevOrientation = useRef(orientation);
  useEffect(() => {
    if (prevOrientation.current === orientation) return;
    prevOrientation.current = orientation;
    prevPointer.current = pointer;
    centerOn(pointer, true);
    redraw();
  }, [orientation, pointer, centerOn, redraw]);

  useEffect(() => {
    if (prevPointer.current !== pointer) {
      ensureVisible(pointer);
      prevPointer.current = pointer;
    }
    redraw();
  }, [pointer, redraw, ensureVisible]);

  useEffect(() => { redraw(); }, [redraw]);

  // The dimension labels use the web font, which may arrive after the first
  // draw; repaint once it does instead of keeping the fallback glyphs.
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    fonts.addEventListener("loadingdone", redraw);
    return () => fonts.removeEventListener("loadingdone", redraw);
  }, [redraw]);

  // Keep a ref to the latest redraw so the wheel handler (registered once) always calls fresh.
  const redrawRef = useRef(redraw);
  useEffect(() => { redrawRef.current = redraw; }, [redraw]);

  // Trackpad / mouse-wheel: two-finger scroll -> pan; Ctrl/Meta + scroll -> zoom (clamped [MIN_CELL,64]).
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
        v.cell = Math.max(E.MIN_CELL, Math.min(64, v.cell * factor));
        v.panX = px - cx * v.cell; v.panY = py - cy * v.cell;
      } else {
        v.panX -= e.deltaX; v.panY -= e.deltaY;
      }
      redrawRef.current();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // pan + pinch-zoom gestures (touch), single-pointer pan (mouse)
  const onPointerDown = useCallback((e: CanvasPointerEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (isTouchEvent(e) && e.touches.length >= 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const mx = (t0.clientX + t1.clientX) / 2 - r.left;
      const my = (t0.clientY + t1.clientY) / 2 - r.top;
      const v = viewRef.current;
      drag.current = { type: "pinch", d: pinchDist(e), x: mx, y: my, cell: v.cell, panX: v.panX, panY: v.panY };
      return;
    }
    const p = localPt(e, canvas);
    drag.current = { type: "pan", x: p.x, y: p.y, panX: viewRef.current.panX, panY: viewRef.current.panY };
  }, []);

  const onPointerMove = useCallback((e: CanvasPointerEvent) => {
    const d = drag.current; if (!d) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (d.type === "pinch") {
      if (!isTouchEvent(e) || e.touches.length < 2) return;
      const t0 = e.touches[0], t1 = e.touches[1];
      const mx = (t0.clientX + t1.clientX) / 2 - r.left;
      const my = (t0.clientY + t1.clientY) / 2 - r.top;
      const nd = pinchDist(e);
      const v = viewRef.current;
      // world point under the gesture's start midpoint stays pinned to the live midpoint
      const cx = (d.x - d.panX) / d.cell, cy = (d.y - d.panY) / d.cell;
      v.cell = Math.max(E.MIN_CELL, Math.min(64, d.cell * (nd / d.d)));
      v.panX = mx - cx * v.cell;
      v.panY = my - cy * v.cell;
      redraw();
      return;
    }
    const p = localPt(e, canvas);
    const v = viewRef.current;
    v.panX = d.panX + (p.x - d.x);
    v.panY = d.panY + (p.y - d.y);
    redraw();
  }, [redraw]);

  const onPointerUp = useCallback(() => { drag.current = null; }, []);

  // Home: restore the entry framing (whole selection, current stitch centered).
  const recenter = useCallback(() => {
    centerOn(pointer, true);
    redraw();
  }, [centerOn, pointer, redraw]);

  const done = pointer >= seq.length;
  // tint = color of the CURRENT stitch (the one this press marks done)
  const current = !done ? (seq[pointer] || null) : null;
  const currentColor = current ? (cells[E.key(current.x, current.y)] || bg) : null;
  const nextStyle: CSSVars = done || !currentColor
    ? {}
    : { "--next-bg": currentColor, "--next-fg": E.contrastInk(currentColor) };

  // stitches left in the current color run, counting the current one
  const runLeft = done ? 0 : E.runEndPointer(sel, seq, cells, bg, pointer) - pointer;

  // floor so the label never reads 100% while stitches remain
  const percent = done ? 100 : Math.floor((pointer / seq.length) * 100);

  const holdNext = useHoldRepeat(onNext, done);
  const holdUndo = useHoldRepeat(onUndo, pointer === 0);

  return (
    <div className={styles.stitchApp}>
      <header className={styles.stitchTopbar}>
        <button className={`${controls.btn} ${controls.btnGhost}`} onClick={onExit}>
          <Icons.Exit size={18} /> Edit Pattern
        </button>
        <div className={styles.topbarSpacer} />
        {!done && (
          <span className={styles.progressLabel} title={`${pointer} of ${seq.length} stitches`}>
            {percent}%
          </span>
        )}
        {done && (
          <span className={`${styles.stitchCompleteTag} ${controls.hideMobile}`}>
            <Icons.Check size={16} /> Pattern complete
          </span>
        )}
        <button className={`${controls.iconbtn} ${controls.bordered}`}
          onClick={() => onReorder("flip")} aria-pressed={flipped} aria-label="Flip row direction"
          title={flipped ? "First row: right to left" : "First row: left to right"}>
          <Icons.Flip size={20} />
        </button>
        <button className={`${controls.iconbtn} ${controls.bordered}`}
          onClick={() => onReorder("rotate")} aria-label="Rotate pattern" title="Rotate pattern 90°">
          <Icons.Rotate size={20} />
        </button>
      </header>

      <div className={styles.stitchCanvasWrap}>
        <canvas ref={canvasRef} className={styles.canvasEl}
          onMouseDown={onPointerDown} onMouseMove={onPointerMove}
          onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp} />
        <div className={styles.canvasOverlay}>
          <button onClick={onCompleteRow} disabled={done}
            title="Mark row complete" aria-label="Mark row complete"><Icons.ChevronUp size={20} /></button>
          <button onClick={onUncompleteRow} disabled={pointer === 0}
            title="Mark row uncomplete" aria-label="Mark row uncomplete"><Icons.ChevronDown size={20} /></button>
          <button onClick={recenter} title="Recenter on current stitch" aria-label="Recenter"><Icons.Home size={20} /></button>
        </div>
      </div>

      <div className={styles.stitchActionbar}>
        <button className={styles.btnUndoStitch} {...holdUndo} disabled={pointer === 0}>
          <Icons.Undo size={20} /> Undo
        </button>
        <button className={`${styles.btnNext} ${styles.btnSkip}${done ? ` ${styles.done}` : ""}`} style={nextStyle} onClick={onSkip} disabled={done}
          title="Skip to the end of this color" aria-label={`Skip ${runLeft} ${runLeft === 1 ? "stitch" : "stitches"} in this color`}>
          <Icons.SkipForward size={18} />
          {!done && <span className={styles.skipCount}>{runLeft}</span>}
        </button>
        <button className={`${styles.btnNext}${done ? ` ${styles.done}` : ""}`} style={nextStyle}
          {...holdNext} disabled={done}>
          {done ? (
            <><Icons.Check size={22} /> All stitched</>
          ) : (
            "Next"
          )}
        </button>
      </div>
    </div>
  );
}
