/* ============================================================
   DesignTopBar — Design View top bar.
   ============================================================ */
import type { Dispatch, SetStateAction } from "react";
import * as Icons from "../icons/icons";
import type { IconComponent } from "../icons/icons";
import type { Tool } from "../types";
import controls from "../styles/controls.module.css";
import styles from "./DesignTopBar.module.css";

interface SegProps {
  icon: IconComponent;
  label: string;
  active: boolean;
  onClick: () => void;
}

function Seg({ icon: Icon, label, active, onClick }: SegProps) {
  return (
    <button className={`${styles.segBtn}${active ? ` ${styles.active}` : ""}`} onClick={onClick}>
      <Icon size={18} />
      <span className={styles.segText}>{label}</span>
    </button>
  );
}

interface IconBtnProps {
  icon: IconComponent;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}

function IconBtn({ icon: Icon, onClick, disabled, title }: IconBtnProps) {
  return (
    <button className={controls.iconbtn} onClick={onClick} disabled={disabled} title={title} aria-label={title}>
      <Icon size={19} />
    </button>
  );
}

export interface DesignTopBarProps {
  name: string;
  onName: Dispatch<SetStateAction<string>>;
  tool: Tool;
  setTool: Dispatch<SetStateAction<Tool>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canBegin: boolean;
  onBegin: () => void;
  onNewPattern: () => void;
}

export function DesignTopBar(props: DesignTopBarProps) {
  const {
    name, onName, tool, setTool,
    canUndo, canRedo, onUndo, onRedo,
    canBegin, onBegin, onNewPattern,
  } = props;

  return (
    <header className={styles.topbar}>
      <div className={`${styles.wordmark} ${styles.hideMobile}`}>
        <span className={styles.wordmarkMark}><Icons.Yarn size={24} /></span>
        <span className={styles.wordmarkText}>Stitch Grid</span>
      </div>

      <div className={styles.nameField} title="Pattern name">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          spellCheck={false}
          aria-label="Pattern name"
        />
        <span className={styles.editDot}><Icons.Edit size={14} /></span>
      </div>

      <div className={`${controls.vDivider} ${styles.hideMobile}`} />

      {/* Paint tools */}
      <div className={styles.segmented}>
        <Seg icon={Icons.Pencil} label="Pencil" active={tool === "pencil"} onClick={() => setTool("pencil")} />
        <Seg icon={Icons.Eraser} label="Eraser" active={tool === "eraser"} onClick={() => setTool("eraser")} />
        <Seg icon={Icons.Bucket} label="Fill" active={tool === "bucket"} onClick={() => setTool("bucket")} />
        <Seg icon={Icons.Line} label="Line" active={tool === "line"} onClick={() => setTool("line")} />
        <Seg icon={Icons.Rect} label="Rect" active={tool === "rect"} onClick={() => setTool("rect")} />
      </div>

      <div className={styles.topbarSpacer} />

      {/* Begin stitching */}
      <button className={`${controls.btn} ${controls.btnPrimary} ${styles.hideMobile}`} disabled={!canBegin} onClick={onBegin}>
        <Icons.Begin size={17} /> Begin Stitching
      </button>
      <button
        className={`${controls.iconbtn} ${controls.bordered} ${styles.onlyMobile}`}
        disabled={!canBegin}
        onClick={onBegin}
        title="Begin Stitching"
        style={{ color: canBegin ? "var(--accent)" : undefined }}
      >
        <Icons.Begin size={19} />
      </button>

      <div className={controls.vDivider} />

      {/* History */}
      <div className={controls.iconGroup}>
        <IconBtn icon={Icons.Undo} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
        <IconBtn icon={Icons.Redo} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" />
      </div>

      <div className={`${controls.vDivider} ${styles.hideMobile}`} />
      <button className={`${controls.iconbtn} ${controls.bordered} ${styles.hideMobile}`} onClick={onNewPattern} title="New pattern">
        <Icons.Sparkle size={18} />
      </button>
    </header>
  );
}
