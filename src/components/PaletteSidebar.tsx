/* ============================================================
   PaletteSidebar — desktop color palette sidebar.
   ============================================================ */
import { useRef, useState, type DragEvent, type MouseEvent } from "react";
import * as Icons from "../icons/icons";
import type { Swatch } from "../types";
import styles from "./Palette.module.css";

export interface PaletteSidebarProps {
  palette: Swatch[];
  bg: Swatch;
  activeId: string;
  onSelect: (id: string) => void;
  onEdit: (id: string, rect: DOMRect) => void;
  onAdd: (rect: DOMRect) => void;
  onReorder: (fromId: string, toId: string) => void;
}

export function PaletteSidebar(props: PaletteSidebarProps) {
  const { palette, bg, activeId, onSelect, onEdit, onAdd, onReorder } = props;
  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const rows = [bg, ...palette];

  function handleDrop(targetId: string) {
    if (dragId.current != null && dragId.current !== targetId && targetId !== bg.id) {
      onReorder(dragId.current, targetId);
    }
    dragId.current = null;
    setOverId(null);
  }

  return (
    <aside className={styles.palette}>
      <div className={styles.paletteHead}>
        <span className={styles.paletteTitle}>Palette</span>
      </div>
      <div className={styles.paletteList}>
        {rows.map((sw) => {
          const isBg = sw.id === bg.id;
          const rowClass = `${styles.swatchRow}${activeId === sw.id ? ` ${styles.active}` : ""}${overId === sw.id ? ` ${styles.dragging}` : ""}`;
          return (
            <div key={sw.id}
              className={rowClass}
              onClick={() => onSelect(sw.id)}
              onDragOver={(e: DragEvent<HTMLDivElement>) => { if (!isBg) { e.preventDefault(); setOverId(sw.id); } }}
              onDrop={() => handleDrop(sw.id)}>
              <span className={styles.swatchDrag}
                draggable={!isBg}
                onDragStart={(e: DragEvent<HTMLSpanElement>) => { dragId.current = sw.id; e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { dragId.current = null; setOverId(null); }}
                style={{ visibility: isBg ? "hidden" : "visible" }}
                onClick={(e: MouseEvent) => e.stopPropagation()}>
                <Icons.Drag size={16} />
              </span>
              <span className={`${styles.swatchChip}${isBg ? ` ${styles.bgChip}` : ""}`}
                style={{ background: sw.color }} />
              <span className={styles.swatchLabel}>
                {sw.label}
                {isBg && <span className={styles.bgTag}>Background</span>}
              </span>
              <button className={styles.swatchEdit}
                onClick={(e) => { e.stopPropagation(); onEdit(sw.id, e.currentTarget.getBoundingClientRect()); }}
                title="Edit color">
                <Icons.Edit size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <div className={styles.paletteFoot}>
        <button className={styles.addSwatch} onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())}>
          <span className={styles.plusChip}><Icons.Add size={15} /></span>
          Add color
        </button>
      </div>
    </aside>
  );
}
