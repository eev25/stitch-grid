/* ============================================================
   Dialog — "new pattern" (destructive) and "new session"
   (confirm) modal dialogs.
   ============================================================ */
import * as Icons from "../icons/icons";
import type { DialogState } from "../types";
import controls from "../styles/controls.module.css";
import styles from "./Dialog.module.css";

export interface DialogProps {
  dialog: DialogState;
  onCancel: () => void;
  onNewPattern: () => void;
  onNewSession: () => void;
}

export function Dialog({ dialog, onCancel, onNewPattern, onNewSession }: DialogProps) {
  if (dialog.type === "new") {
    return (
      <div className={styles.dialogBackdrop} onMouseDown={onCancel}>
        <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
          <div className={`${styles.dialogIcon} ${styles.warn}`}><Icons.Trash size={22} /></div>
          <h2>Start a new pattern?</h2>
          <p>This will permanently erase your current pattern, palette, and stitching progress. This can&apos;t be undone.</p>
          <div className={styles.dialogActions}>
            <button className={`${controls.btn} ${controls.btnGhost}`} onClick={onCancel}>Cancel</button>
            <button className={`${controls.btn} ${controls.btnDanger}`} onClick={onNewPattern}>Erase &amp; start new</button>
          </div>
        </div>
      </div>
    );
  }
  if (dialog.type === "newsession") {
    return (
      <div className={styles.dialogBackdrop} onMouseDown={onCancel}>
        <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
          <div className={styles.dialogIcon}><Icons.Begin size={22} /></div>
          <h2>Start a new stitching session?</h2>
          <p>Starting a new session will discard your progress on the previous selection. Continue?</p>
          <div className={styles.dialogActions}>
            <button className={`${controls.btn} ${controls.btnGhost}`} onClick={onCancel}>Cancel</button>
            <button className={`${controls.btn} ${controls.btnPrimary}`} onClick={onNewSession}>Start new session</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
