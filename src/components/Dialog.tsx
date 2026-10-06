/* ============================================================
   Dialog — "new pattern" (destructive) and "new session"
   (confirm) modal dialogs, plus the shared DialogFrame that
   other dialogs (e.g. UploadDialog) are built on.
   ============================================================ */
import type { ReactNode } from "react";
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

export interface DialogFrameProps {
  onCancel: () => void;
  /** Wider card that scrolls when taller than the screen. */
  wide?: boolean;
  label?: string;
  children: ReactNode;
}

/** Modal backdrop + card. Pressing the backdrop cancels. */
export function DialogFrame({ onCancel, wide, label, children }: DialogFrameProps) {
  return (
    <div className={styles.dialogBackdrop} onMouseDown={onCancel}>
      <div className={`${styles.dialog}${wide ? ` ${styles.wide}` : ""}`} role="dialog" aria-modal="true" aria-label={label}
        onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Dialog({ dialog, onCancel, onNewPattern, onNewSession }: DialogProps) {
  if (dialog.type === "new") {
    return (
      <DialogFrame onCancel={onCancel}>
        <div className={`${styles.dialogIcon} ${styles.warn}`}><Icons.Trash size={22} /></div>
        <h2>Start a new pattern?</h2>
        <p>This will permanently erase your current pattern and stitching progress. This can&apos;t be undone.</p>
        <div className={styles.dialogActions}>
          <button className={`${controls.btn} ${controls.btnGhost}`} onClick={onCancel}>Cancel</button>
          <button className={`${controls.btn} ${controls.btnDanger}`} onClick={onNewPattern}>Erase &amp; start new</button>
        </div>
      </DialogFrame>
    );
  }
  if (dialog.type === "newsession") {
    return (
      <DialogFrame onCancel={onCancel}>
        <div className={styles.dialogIcon}><Icons.Begin size={22} /></div>
        <h2>Start a new stitching session?</h2>
        <p>Starting a new session will discard your progress on the previous selection. Continue?</p>
        <div className={styles.dialogActions}>
          <button className={`${controls.btn} ${controls.btnGhost}`} onClick={onCancel}>Cancel</button>
          <button className={`${controls.btn} ${controls.btnPrimary}`} onClick={onNewSession}>Start new session</button>
        </div>
      </DialogFrame>
    );
  }
  return null;
}
