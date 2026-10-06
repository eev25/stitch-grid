/* ============================================================
   ColorEditor — anchored color/label editor popover.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import * as Icons from "../icons/icons";
import type { Swatch } from "../types";
import controls from "../styles/controls.module.css";
import styles from "./Palette.module.css";

/** Normalize a hex color string ("#abc" or "abc" -> "#aabbcc"); null if invalid. */
export function normHex(v: string): string | null {
  let h = (v || "").trim();
  if (h && h[0] !== "#") h = "#" + h;
  if (/^#([0-9a-fA-F]{3})$/.test(h)) h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  return /^#([0-9a-fA-F]{6})$/.test(h) ? h.toLowerCase() : null;
}

export interface ColorEditorProps {
  swatch: Swatch;
  isBg: boolean;
  anchorRect: DOMRect;
  onChange: (sw: Swatch) => void;
  onDelete: (id: string) => void;
  onSetBackground: (id: string) => void;
  onClose: () => void;
}

interface PopoverPos { left: number; top: number; }

export function ColorEditor(props: ColorEditorProps) {
  const { swatch, isBg, anchorRect, onChange, onDelete, onSetBackground, onClose } = props;
  const [hex, setHex] = useState(swatch.color);
  const [label, setLabel] = useState(swatch.label);
  const [hexText, setHexText] = useState(swatch.color);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPos | null>(null);

  useEffect(() => {
    // position next to anchor, kept on screen
    const pop = popRef.current;
    if (!pop || !anchorRect) return;
    const pw = 256, ph = pop.offsetHeight || 220, gap = 10;
    let left = anchorRect.right + gap;
    if (left + pw > window.innerWidth - 12) left = anchorRect.left - pw - gap;
    if (left < 12) left = 12;
    let top = anchorRect.top;
    if (top + ph > window.innerHeight - 12) top = window.innerHeight - ph - 12;
    if (top < 12) top = 12;
    setPos({ left, top });
  }, [anchorRect]);

  function commit(nextHex: string | null, nextLabel: string | null) {
    onChange({ ...swatch, color: nextHex ?? hex, label: nextLabel ?? label });
  }
  function onHexInput(v: string) {
    setHexText(v);
    const n = normHex(v);
    if (n) { setHex(n); commit(n, null); }
  }

  return (
    <>
      <div className={styles.popoverBackdrop} onMouseDown={onClose} onTouchStart={onClose} />
      <div className={styles.popover} ref={popRef}
        style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}>
        <div className={styles.popoverRow}>
          <label>Color</label>
          <div className={styles.colorInputWrap}>
            <input type="color" value={hex}
              onChange={(e) => { setHex(e.target.value); setHexText(e.target.value); commit(e.target.value, null); }} />
            <input className={styles.hexInput} value={hexText}
              onChange={(e) => onHexInput(e.target.value)}
              onBlur={() => setHexText(hex)} maxLength={7} spellCheck={false} />
          </div>
        </div>
        <div className={styles.popoverRow}>
          <label>{isBg ? "Background label" : "Label"}</label>
          <input className={styles.textInput} value={label}
            onChange={(e) => { setLabel(e.target.value); commit(null, e.target.value); }}
            placeholder="Color name" />
        </div>
        {!isBg && (
          <button className={`${controls.btn} ${controls.btnGhost} ${styles.popoverWide}`} style={{ height: 36 }}
            onClick={() => onSetBackground(swatch.id)}
            title="Swap this color with the background">
            Set as background
          </button>
        )}
        <div className={styles.popoverActions}>
          <button className={styles.linkDanger} disabled={isBg}
            onClick={() => { if (!isBg) onDelete(swatch.id); }}
            title={isBg ? "The background can't be deleted" : "Delete swatch"}>
            <Icons.Trash size={16} /> Delete
          </button>
          <button className={`${controls.btn} ${controls.btnGhost}`} style={{ height: 36 }} onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}
