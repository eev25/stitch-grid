/* ============================================================
   App — root component: wires the pattern store, the design
   canvas surface, and all top-level UI (topbar, palette, canvas
   overlays, image bar, mobile palette, color editor, dialogs,
   Stitching Mode).
   ============================================================ */
import { useState } from "react";
import * as Icons from "./icons/icons";
import { areaCenteredAt, imageAreaSize } from "./engine/image";
import { encodeImage } from "./lib/imageFile";
import { newImageId, putImageBlob } from "./lib/imageStore";
import { usePatternStore } from "./hooks/usePatternStore";
import { useDesignCanvas } from "./hooks/useDesignCanvas";
import { DesignTopBar } from "./components/DesignTopBar";
import { PaletteSidebar } from "./components/PaletteSidebar";
import { MobilePalette } from "./components/MobilePalette";
import { ColorEditor } from "./components/ColorEditor";
import { StitchingView } from "./components/StitchingView";
import { Dialog } from "./components/Dialog";
import { ImageBar } from "./components/ImageBar";
import { UploadDialog, type UploadResult } from "./components/UploadDialog";
import styles from "./App.module.css";

export function App() {
  const {
    seeded, bg, palette, activeId, setActiveId,
    cells, setCells, area, setArea, stitch, tool, setTool,
    topView, editor, setEditor, dialog, setDialog,
    seq, activeColor, canBegin, canUndo, canRedo, editingSwatch,
    pushHistory, commitCells, doUndo, doRedo,
    updateSwatch, deleteSwatch, setAsBackground, addSwatch, reorder,
    beginStitching, confirmNewSession, exitStitching, stitchNext, stitchUndo,
    doNewPattern,
    image, imageSource, imageHidden, setImageHidden, canPixelate,
    attachImage, removeImage, pixelate,
  } = usePatternStore();

  const canvas = useDesignCanvas({
    cells, setCells, bg, area, setArea, activeColor, tool, topView,
    pushHistory, commitCells, fitOnLoad: seeded,
    image, imageSource, imageHidden,
  });

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const hasCells = Object.keys(cells).length > 0;

  // Store the downscaled image in IndexedDB, then make it the working area:
  // 40 stitches wide, centered on the viewport, and framed. (If storage
  // fails the image still works this session; on reload the area falls
  // back to a vanilla one.)
  async function handleAddImage(r: UploadResult) {
    const blobId = newImageId();
    const blob = await encodeImage(r.source).catch(() => null);
    if (blob) await putImageBlob(blobId, blob);
    const { w, h } = imageAreaSize(r.source.width / r.source.height);
    const c = canvas.viewportCenter();
    const rect = areaCenteredAt(c.x, c.y, w, h);
    attachImage({ blobId, source: r.source, colors: r.colors, clear: r.clear, area: rect });
    canvas.frameArea(rect);
    setUploadFile(null);
  }

  // Reset state, then recenter the design view (store and canvas live in
  // separate hooks, so the two steps are called here).
  function handleNewPattern() {
    doNewPattern();
    canvas.home();
  }

  if (topView === "stitching" && stitch) {
    return (
      <StitchingView sel={stitch.sel} seq={seq} pointer={stitch.pointer}
        cells={cells} bg={bg.color}
        onNext={stitchNext} onUndo={stitchUndo} onExit={exitStitching} />
    );
  }

  return (
    <div className={styles.app}>
      <DesignTopBar
        tool={tool} setTool={setTool}
        canBegin={canBegin} onBegin={beginStitching}
        onNewPattern={() => setDialog({ type: "new" })}
        onUploadImage={setUploadFile} />

      <div className={styles.workspace}>
        <PaletteSidebar palette={palette} bg={bg} activeId={activeId}
          onSelect={setActiveId}
          onEdit={(id, rect) => { setActiveId(id); setEditor({ id, rect }); }}
          onAdd={addSwatch} onReorder={reorder} />

        <div className={styles.canvasWrap}>
          <canvas ref={canvas.canvasRef} className={`${styles.canvasEl} ${styles.modePaint}`}
            onMouseDown={canvas.onPointerDown} onMouseMove={canvas.onPointerMove}
            onMouseUp={canvas.onPointerUp} onMouseLeave={canvas.onPointerUp}
            onTouchStart={canvas.onPointerDown} onTouchMove={canvas.onPointerMove} onTouchEnd={canvas.onPointerUp} />

          {!hasCells && !image && (
            <div className={styles.canvasHint}>
              <Icons.Pencil size={15} /> Pick a color, then paint your first stitch
            </div>
          )}

          {/* The image bar shows W x H itself, so skip the badge while it's up. */}
          {canvas.dimBadge && canvas.resizing && !image && (
            <div className={styles.dimBadge} style={{ left: canvas.dimBadge.left, top: canvas.dimBadge.top }}>
              {canvas.dimBadge.text}
            </div>
          )}

          {image && area && canvas.areaBox && (
            <ImageBar area={area} box={canvas.areaBox} viewport={canvas.viewport} cell={canvas.cell}
              hidden={imageHidden} canPixelate={canPixelate}
              onMoveArea={setArea} onPixelate={pixelate}
              onToggleHidden={() => setImageHidden((h) => !h)} onRemove={removeImage} />
          )}

          <div className={`${styles.canvasOverlay}${canvas.isTouch ? ` ${styles.touch}` : ""}`}>
            <button onClick={canvas.recenter} title="Recenter on working area" aria-label="Recenter"><Icons.Home size={20} /></button>
            {/* Keyboard users have Ctrl+Z / Ctrl+Shift+Z; touch and narrow screens get buttons */}
            <button className={styles.historyBtn} onClick={doUndo} disabled={!canUndo} title="Undo" aria-label="Undo"><Icons.Undo size={20} /></button>
            <button className={styles.historyBtn} onClick={doRedo} disabled={!canRedo} title="Redo" aria-label="Redo"><Icons.Redo size={20} /></button>
          </div>
        </div>
      </div>

      <MobilePalette palette={palette} bg={bg} activeId={activeId}
        onSelect={setActiveId} onEdit={(id, rect) => { setActiveId(id); setEditor({ id, rect }); }} onAdd={addSwatch} />

      {editor && editingSwatch && (
        <ColorEditor swatch={editingSwatch} isBg={editor.id === bg.id} anchorRect={editor.rect}
          onChange={updateSwatch} onDelete={deleteSwatch} onSetBackground={setAsBackground}
          onClose={() => setEditor(null)} />
      )}

      {dialog && (
        <Dialog dialog={dialog} onCancel={() => setDialog(null)}
          onNewPattern={handleNewPattern} onNewSession={confirmNewSession} />
      )}

      {uploadFile && (
        <UploadDialog file={uploadFile} palette={palette}
          hasStitchProgress={!!stitch && stitch.pointer > 0}
          onCancel={() => setUploadFile(null)} onAdd={handleAddImage} />
      )}
    </div>
  );
}
