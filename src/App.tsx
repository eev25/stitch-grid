/* ============================================================
   App — root component: wires the pattern store, the design
   canvas surface, and all top-level UI (topbar, palette, canvas
   overlays, mobile palette, color editor, dialogs, Stitching Mode).
   Ported from design-reference/main.jsx (App + Dialog wiring).
   ============================================================ */
import * as Icons from "./icons/icons";
import { usePatternStore } from "./hooks/usePatternStore";
import { useDesignCanvas } from "./hooks/useDesignCanvas";
import { DesignTopBar } from "./components/DesignTopBar";
import { PaletteSidebar } from "./components/PaletteSidebar";
import { MobilePalette } from "./components/MobilePalette";
import { ColorEditor } from "./components/ColorEditor";
import { StitchingView } from "./components/StitchingView";
import { Dialog } from "./components/Dialog";
import styles from "./App.module.css";

export function App() {
  const {
    name, setName, bg, palette, activeId, setActiveId,
    cells, setCells, area, setArea, stitch, tool, setTool,
    topView, editor, setEditor, dialog, setDialog,
    seq, activeColor, canBegin, canUndo, canRedo, editingSwatch,
    pushHistory, commitCells, doUndo, doRedo,
    updateSwatch, deleteSwatch, addSwatch, reorder,
    beginStitching, confirmNewSession, exitStitching, stitchNext, stitchUndo,
    doNewPattern,
  } = usePatternStore();

  const canvas = useDesignCanvas({
    cells, setCells, bg, area, setArea, activeColor, tool, topView,
    pushHistory, commitCells,
  });

  // Reset state, then recenter the design view (ported from main.jsx's
  // doNewPattern, which calls home() at the end — split across two hooks here).
  function handleNewPattern() {
    doNewPattern();
    canvas.home();
  }

  if (topView === "stitching" && stitch) {
    return (
      <StitchingView name={name} sel={stitch.sel} seq={seq} pointer={stitch.pointer}
        cells={cells} bg={bg.color}
        onNext={stitchNext} onUndo={stitchUndo} onExit={exitStitching} />
    );
  }

  return (
    <div className={styles.app}>
      <DesignTopBar
        name={name} onName={setName}
        tool={tool} setTool={setTool}
        canUndo={canUndo} canRedo={canRedo} onUndo={doUndo} onRedo={doRedo}
        canBegin={canBegin} onBegin={beginStitching}
        onNewPattern={() => setDialog({ type: "new" })} />

      <div className={styles.workspace}>
        <PaletteSidebar palette={palette} bg={bg} activeId={activeId}
          onSelect={setActiveId}
          onEdit={(id, rect) => setEditor({ id, rect })}
          onAdd={addSwatch} onReorder={reorder} />

        <div className={styles.canvasWrap} ref={canvas.wrapRef}>
          <canvas ref={canvas.canvasRef} className={`${styles.canvasEl} ${styles.modePaint}`}
            onMouseDown={canvas.onPointerDown} onMouseMove={canvas.onPointerMove}
            onMouseUp={canvas.onPointerUp} onMouseLeave={canvas.onPointerUp}
            onTouchStart={canvas.onPointerDown} onTouchMove={canvas.onPointerMove} onTouchEnd={canvas.onPointerUp} />

          {Object.keys(cells).length === 0 && (
            <div className={styles.canvasHint}>
              <Icons.Pencil size={15} /> Pick a color, then paint your first stitch
            </div>
          )}

          {canvas.dimBadge && canvas.resizing && (
            <div className={styles.dimBadge} style={{ left: canvas.dimBadge.left, top: canvas.dimBadge.top }}>
              {canvas.dimBadge.text}
            </div>
          )}

          <div className={styles.zoomOverlay}>
            <button onClick={canvas.recenter} title="Recenter on working area" aria-label="Recenter"><Icons.Home size={20} /></button>
            <button onClick={() => canvas.zoom(1)} title="Zoom in" aria-label="Zoom in"><Icons.Plus size={20} /></button>
            <button onClick={() => canvas.zoom(-1)} title="Zoom out" aria-label="Zoom out"><Icons.Minus size={20} /></button>
          </div>
        </div>
      </div>

      <MobilePalette palette={palette} bg={bg} activeId={activeId}
        onSelect={setActiveId} onEdit={(id, rect) => setEditor({ id, rect })} onAdd={addSwatch} />

      {editor && editingSwatch && (
        <ColorEditor swatch={editingSwatch} isBg={editor.id === bg.id} anchorRect={editor.rect}
          onChange={updateSwatch} onDelete={deleteSwatch} onClose={() => setEditor(null)} />
      )}

      {dialog && (
        <Dialog dialog={dialog} onCancel={() => setDialog(null)}
          onNewPattern={handleNewPattern} onNewSession={confirmNewSession} />
      )}
    </div>
  );
}
