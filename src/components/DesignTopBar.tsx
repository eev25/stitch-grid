/* ============================================================
   DesignTopBar — Design View top bar.
   ============================================================ */
import { useId, useRef, type Dispatch, type SetStateAction } from "react";
import * as Icons from "../icons/icons";
import type { IconComponent } from "../icons/icons";
import { ACCEPTED_IMAGE_TYPES } from "../lib/imageFile";
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

export interface DesignTopBarProps {
  tool: Tool;
  setTool: Dispatch<SetStateAction<Tool>>;
  canBegin: boolean;
  onBegin: () => void;
  onNewPattern: () => void;
  onUploadImage: (file: File) => void;
}

export function DesignTopBar(props: DesignTopBarProps) {
  const {
    tool, setTool,
    canBegin, onBegin, onNewPattern, onUploadImage,
  } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const pickFile = () => fileRef.current?.click();

  return (
    <header className={styles.topbar}>
      <div className={`${styles.wordmark} ${controls.hideMobile}`}>
        <span className={styles.wordmarkMark} aria-hidden="true">🧶</span>
        <span className={styles.wordmarkText}>Stitch Grid</span>
      </div>

      {/* Paint tools */}
      <div className={styles.segmented}>
        <Seg icon={Icons.Pencil} label="Pencil" active={tool === "pencil"} onClick={() => setTool("pencil")} />
        <Seg icon={Icons.Eraser} label="Eraser" active={tool === "eraser"} onClick={() => setTool("eraser")} />
        <Seg icon={Icons.Bucket} label="Fill" active={tool === "bucket"} onClick={() => setTool("bucket")} />
        <Seg icon={Icons.Line} label="Line" active={tool === "line"} onClick={() => setTool("line")} />
        <Seg icon={Icons.Rect} label="Rect" active={tool === "rect"} onClick={() => setTool("rect")} />
      </div>

      <div className={styles.topbarSpacer} />

      {/* Upload an image to trace / pixelate */}
      <button
        className={`${controls.btn} ${controls.btnGhost} ${styles.uploadBtn}`}
        onClick={pickFile}
        title="Upload image"
        aria-label="Upload image"
      >
        <Icons.Picture size={18} />
        <span className={styles.uploadText}>Upload image</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        hidden
        data-testid="image-upload-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // let the same file be picked again
          if (file) onUploadImage(file);
        }}
      />

      {/* Begin stitching */}
      <button
        className={`${controls.btn} ${controls.btnPrimary} ${styles.beginBtn}`}
        disabled={!canBegin}
        onClick={onBegin}
        title="Begin Stitching"
        aria-label="Begin Stitching"
      >
        <Icons.Begin size={17} />
        <span className={styles.beginText}>Begin Stitching</span>
      </button>

      <div className={`${controls.vDivider} ${controls.hideMobile}`} />
      <button
        className={`${controls.iconbtn} ${controls.bordered} ${styles.newBtn}`}
        onClick={onNewPattern}
        title="New pattern"
        aria-label="New pattern"
      >
        <Icons.Trash size={18} />
      </button>

      {/* Narrow screens: Upload image and New pattern move into this menu.
          The native popover handles open/close, outside taps and Escape. */}
      <button
        className={`${controls.iconbtn} ${controls.bordered} ${styles.moreBtn}`}
        popoverTarget={menuId}
        title="More actions"
        aria-label="More actions"
      >
        <Icons.More size={18} />
      </button>
      <div id={menuId} popover="auto" className={styles.menu}>
        <button className={`${controls.btn} ${styles.menuItem}`}
          popoverTarget={menuId} popoverTargetAction="hide" onClick={pickFile}>
          <Icons.Picture size={18} />Upload image
        </button>
        <button className={`${controls.btn} ${styles.menuItem}`}
          popoverTarget={menuId} popoverTargetAction="hide" onClick={onNewPattern}>
          <Icons.Trash size={18} />New pattern
        </button>
      </div>
    </header>
  );
}
