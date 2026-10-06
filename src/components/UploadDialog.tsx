/* ============================================================
   UploadDialog — preview an uploaded image, choose how many
   colors to extract, review/edit them, and add the image as the
   working area.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import * as Icons from "../icons/icons";
import { extractPalette } from "../engine/color";
import { imageColorLabel, nextImageColorNumber } from "../engine/palette";
import { ACCEPTED_IMAGE_TYPES, EXTRACT_EDGE, decodeImage, readPixels, scaledCanvas } from "../lib/imageFile";
import type { Swatch } from "../types";
import { ColorEditor } from "./ColorEditor";
import { DialogFrame } from "./Dialog";
import controls from "../styles/controls.module.css";
import dialogStyles from "./Dialog.module.css";
import styles from "./UploadDialog.module.css";

export const DEFAULT_COLOR_COUNT = 4;
const MIN_COLORS = 1;
const MAX_COLORS = 16;

interface ExtractedColor {
  color: string;
  /** User-edited label; null uses the default "Image color N". */
  label: string | null;
  checked: boolean;
}

export interface UploadResult {
  source: HTMLCanvasElement;
  colors: Array<{ color: string; label: string }>;
  clear: boolean;
}

export interface UploadDialogProps {
  file: File;
  palette: Swatch[];
  onCancel: () => void;
  onAdd: (result: UploadResult) => Promise<void>;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; source: HTMLCanvasElement; small: ImageData };

const extract = (small: ImageData, k: number): ExtractedColor[] =>
  extractPalette(small, k).map((color) => ({ color, label: null, checked: true }));

export function UploadDialog(props: UploadDialogProps) {
  const { file, palette, onCancel, onAdd } = props;
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [count, setCount] = useState(DEFAULT_COLOR_COUNT);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [clear, setClear] = useState(false);
  const [editing, setEditing] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setLoad({ status: "error", message: "That file type isn't supported. Choose a PNG, JPEG, or WebP image." });
      return;
    }
    let alive = true;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    decodeImage(file).then((source) => {
      if (!alive) return;
      const small = readPixels(scaledCanvas(source, source.width, source.height, EXTRACT_EDGE));
      setLoad({ status: "ready", source, small });
      setColors(extract(small, DEFAULT_COLOR_COUNT));
    }).catch(() => {
      if (alive) setLoad({ status: "error", message: "This image couldn't be read." });
    });
    return () => { alive = false; URL.revokeObjectURL(url); };
  }, [file]);

  // Labels the checked colors will get: edited ones keep theirs, the rest
  // are numbered on from the palette's last "Image color N" (or from 1 when
  // the palette is being replaced).
  const labels = useMemo(() => {
    let n = clear ? 1 : nextImageColorNumber(palette);
    return colors.map((c) => c.label ?? (c.checked ? imageColorLabel(n++) : ""));
  }, [colors, clear, palette]);

  const checkedCount = colors.filter((c) => c.checked).length;

  function changeCount(next: number) {
    if (load.status !== "ready") return;
    const k = Math.max(MIN_COLORS, Math.min(MAX_COLORS, next));
    setCount(k);
    setColors(extract(load.small, k));
    setEditing(null);
  }

  function toggle(i: number) {
    setColors((cs) => {
      // at least one color must stay checked
      if (cs[i].checked && cs.filter((c) => c.checked).length === 1) return cs;
      return cs.map((c, j) => (j === i ? { ...c, checked: !c.checked } : c));
    });
  }

  function editColor(i: number, sw: Swatch) {
    setColors((cs) => cs.map((c, j) => {
      if (j !== i) return c;
      const label = sw.label === labels[i] ? c.label : sw.label.trim() ? sw.label : null;
      return { ...c, color: sw.color, label };
    }));
  }

  async function add() {
    if (load.status !== "ready" || !checkedCount || busy) return;
    setBusy(true);
    try {
      await onAdd({
        source: load.source,
        colors: colors.flatMap((c, i) => (c.checked ? [{ color: c.color, label: labels[i] }] : [])),
        clear,
      });
    } finally {
      setBusy(false);
    }
  }

  const editingSwatch: Swatch | null = editing
    ? { id: `upload-${editing.index}`, color: colors[editing.index].color, label: labels[editing.index] }
    : null;

  return (
    <>
      <DialogFrame onCancel={onCancel} wide label="Upload image">
        <div className={dialogStyles.dialogIcon}><Icons.Picture size={22} /></div>
        <h2>Add an image</h2>
        <p>The image becomes your working area, and its colors are added to your palette.</p>

        {load.status === "error" ? (
          <div className={styles.error} role="alert">{load.message}</div>
        ) : (
          <>
            <div className={styles.preview}>
              {previewUrl && <img src={previewUrl} alt="Uploaded image preview" />}
            </div>

            <div className={styles.countRow}>
              <span className={styles.sectionLabel} id="upload-color-count">Colors</span>
              <div className={styles.stepper} role="group" aria-labelledby="upload-color-count">
                <button className={controls.iconbtn} onClick={() => changeCount(count - 1)}
                  disabled={load.status !== "ready" || count <= MIN_COLORS} aria-label="Fewer colors">
                  <span aria-hidden="true">−</span>
                </button>
                <output className={styles.count} aria-live="polite">{count}</output>
                <button className={controls.iconbtn} onClick={() => changeCount(count + 1)}
                  disabled={load.status !== "ready" || count >= MAX_COLORS} aria-label="More colors">
                  <Icons.Add size={16} />
                </button>
              </div>
            </div>

            {load.status === "ready" && colors.length === 0 && (
              <div className={styles.error}>This image has no opaque pixels to take colors from.</div>
            )}
            {colors.length > 0 && colors.length < count && (
              <div className={styles.note}>Only {colors.length} distinct {colors.length === 1 ? "color" : "colors"} found.</div>
            )}

            <ul className={styles.colorList} aria-label="Extracted colors">
              {colors.map((c, i) => {
                const name = labels[i] || `Color ${i + 1}`;
                return (
                  <li key={i} className={`${styles.colorRow}${c.checked ? "" : ` ${styles.unchecked}`}`}>
                    <input type="checkbox" checked={c.checked} onChange={() => toggle(i)}
                      disabled={c.checked && checkedCount === 1}
                      aria-label={`Add ${name}`} />
                    <button className={styles.chip} style={{ background: c.color }}
                      onClick={(e) => setEditing({ index: i, rect: e.currentTarget.getBoundingClientRect() })}
                      aria-label={`Edit ${name}`} title="Edit color" />
                    <span className={styles.colorLabel}>{c.checked ? labels[i] : "Not added"}</span>
                    <span className={styles.hex}>{c.color}</span>
                  </li>
                );
              })}
            </ul>

            <label className={styles.clearRow}>
              <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} />
              <span>Clear existing work</span>
            </label>
            {clear && (
              <div className={styles.note} role="alert">
                Erases your cells, palette, and any stitching progress. 
              </div>
            )}
          </>
        )}

        <div className={dialogStyles.dialogActions}>
          <button className={`${controls.btn} ${controls.btnGhost}`} onClick={onCancel}>Cancel</button>
          {load.status !== "error" && (
            <button className={`${controls.btn} ${controls.btnPrimary}`} onClick={add}
              disabled={load.status !== "ready" || !checkedCount || busy}>
              Add image
            </button>
          )}
        </div>
      </DialogFrame>

      {editing && editingSwatch && (
        <ColorEditor key={editing.index} swatch={editingSwatch} isBg={false} anchorRect={editing.rect}
          onChange={(sw) => editColor(editing.index, sw)} onClose={() => setEditing(null)} overDialog />
      )}
    </>
  );
}
