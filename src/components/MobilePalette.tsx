/* ============================================================
   MobilePalette — bottom palette strip + expandable sheet.
   ============================================================ */
import { useState } from "react";
import * as Icons from "../icons/icons";
import type { Swatch } from "../types";
import controls from "../styles/controls.module.css";
import styles from "./Palette.module.css";

export interface MobilePaletteProps {
  palette: Swatch[];
  bg: Swatch;
  activeId: string;
  onSelect: (id: string) => void;
  onEdit: (id: string, rect: DOMRect) => void;
  onAdd: (rect: DOMRect) => void;
}

export function MobilePalette(props: MobilePaletteProps) {
  const { palette, bg, activeId, onSelect, onEdit, onAdd } = props;
  const [open, setOpen] = useState(false);
  const rows = [bg, ...palette];

  return (
    <>
      <div className={styles.mobilePalette}>
        <div className={styles.mobileStrip}>
          {rows.map((sw) => (
            <button key={sw.id}
              className={`${styles.mobileChip}${activeId === sw.id ? ` ${styles.active}` : ""}`}
              style={{ background: sw.color }}
              onClick={() => onSelect(sw.id)} aria-label={sw.label} />
          ))}
          <button className={`${styles.mobileChip} ${styles.add}`} onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())}>
            <Icons.Add size={18} />
          </button>
          <button className={styles.mobileExpand} onClick={() => setOpen(true)} aria-label="Expand palette">
            <Icons.ChevronUp size={18} />
          </button>
        </div>
      </div>

      {open && (
        <div className={styles.sheetBackdrop} onClick={() => setOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHead}>
              <h3>Palette</h3>
              <button className={controls.iconbtn} onClick={() => setOpen(false)}><Icons.X size={18} /></button>
            </div>
            <div className={styles.sheetList}>
              {rows.map((sw) => {
                const isBg = sw.id === bg.id;
                return (
                  <div key={sw.id}
                    className={`${styles.swatchRow}${activeId === sw.id ? ` ${styles.active}` : ""}`}
                    onClick={() => onSelect(sw.id)}>
                    <span className={`${styles.swatchChip}${isBg ? ` ${styles.bgChip}` : ""}`} style={{ background: sw.color }} />
                    <span className={styles.swatchLabel}>
                      {sw.label}{isBg && <span className={styles.bgTag}>Background</span>}
                    </span>
                    <button className={styles.swatchEdit} style={{ opacity: 1 }}
                      onClick={(e) => { e.stopPropagation(); onEdit(sw.id, e.currentTarget.getBoundingClientRect()); }}>
                      <Icons.Edit size={17} />
                    </button>
                  </div>
                );
              })}
              <button className={styles.addSwatch} style={{ marginTop: 6 }}
                onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())}>
                <span className={styles.plusChip}><Icons.Add size={15} /></span> Add color
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
