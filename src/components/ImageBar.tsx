/* ============================================================
   ImageBar — DOM toolbar pinned just above the working-area box
   while an image is attached: drag (moves the box + image only),
   Pixelate, Hide/Show cells, Remove, and the W x H readout.
   ============================================================ */
import { useLayoutEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import * as Icons from "../icons/icons";
import { moveArea, placeBar, type ScreenBox } from "../engine/image";
import type { Area } from "../types";
import styles from "./ImageBar.module.css";

export interface ImageBarProps {
  area: Area;
  /** The area's box in canvas-local CSS px. */
  box: ScreenBox;
  viewport: { w: number; h: number };
  /** Current cell size in CSS px (converts drag distance to cells). */
  cell: number;
  hidden: boolean;
  canPixelate: boolean;
  onMoveArea: (area: Area) => void;
  onPixelate: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
}

// Keep bar interactions from ever reaching the canvas (no stray paint).
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function ImageBar(props: ImageBarProps) {
  const { area, box, viewport, cell, hidden, canPixelate, onMoveArea, onPixelate, onToggleHidden, onRemove } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<{ id: number; x: number; y: number; start: Area; dx: number; dy: number } | null>(null);

  // Measure after every render: the bar's size changes with its labels and
  // the responsive (icon-only) layout.
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (w !== size.w || h !== size.h) setSize({ w, h });
  });

  const pos = placeBar(box, size, viewport);

  function onGripDown(e: PointerEvent<HTMLButtonElement>) {
    e.stopPropagation(); e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: area, dx: 0, dy: 0 };
  }
  function onGripMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = Math.round((e.clientX - d.x) / cell), dy = Math.round((e.clientY - d.y) / cell);
    if (dx === d.dx && dy === d.dy) return;
    d.dx = dx; d.dy = dy;
    onMoveArea(moveArea(d.start, dx, dy));
  }
  function onGripUp(e: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  const w = area.x1 - area.x0 + 1, h = area.y1 - area.y0 + 1;

  return (
    <div ref={ref} className={styles.bar} role="toolbar" aria-label="Image"
      style={{ left: pos.left, top: pos.top, visibility: size.w ? undefined : "hidden" }}
      onPointerDown={stop} onMouseDown={stop} onTouchStart={stop} onWheel={stop}>
      <button className={`${styles.btn} ${styles.grip}`} title="Drag to move the image area" aria-label="Drag image area"
        onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}>
        <Icons.Grip size={18} />
      </button>
      <span className={styles.divider} />
      <button className={styles.btn} onClick={onPixelate} disabled={!canPixelate}
        title={canPixelate ? "Paint every cell in the area from the image" : "None of this image's colors are left in the palette"}
        aria-label="Pixelate">
        <Icons.Pixelate size={18} /><span className={styles.label}>Pixelate</span>
      </button>
      <button className={`${styles.btn}${hidden ? ` ${styles.on}` : ""}`} onClick={onToggleHidden}
        title={hidden ? "Show the cells in the area" : "Hide the cells in the area to see the image"}
        aria-label={hidden ? "Show cells" : "Hide cells"}>
        {hidden ? <Icons.Eye size={18} /> : <Icons.EyeOff size={18} />}
        <span className={styles.label}>Peek</span>
      </button>
      <button className={styles.btn} onClick={onRemove} title="Remove the image" aria-label="Remove image">
        <Icons.X size={18} /><span className={styles.label}>Remove</span>
      </button>
      <span className={styles.divider} />
      <span className={styles.size} aria-label={`${w} by ${h} stitches`}>{w} × {h}</span>
    </div>
  );
}
