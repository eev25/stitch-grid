/* ============================================================
   canvasPointer — shared pointer/touch helpers for canvas
   surfaces (Design + Stitching views).
   ============================================================ */
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";

export type CanvasPointerEvent = ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>;

export function isTouchEvent(e: CanvasPointerEvent): e is ReactTouchEvent<HTMLCanvasElement> {
  return "touches" in e;
}

/** Pointer position in canvas-local CSS pixels (first touch, or mouse position). */
export function localPt(e: CanvasPointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const t = isTouchEvent(e) ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

/** Distance between the first two touches, for pinch-zoom. */
export function pinchDist(e: ReactTouchEvent<HTMLCanvasElement>): number {
  const a = e.touches[0], b = e.touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
