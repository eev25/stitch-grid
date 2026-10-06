/* ============================================================
   usePatternStore — root pattern state, history, persistence,
   palette ops, stitching-session ops, and the uploaded image
   attached to the working area.
   View/canvas/pointer handling lives in useDesignCanvas instead.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as E from "../engine/engine";
import { swapWithBackground } from "../engine/palette";
import { DEFAULT_YARNS, sampleCells } from "../engine/sample";
import { pixelateCells, pixelateTargets } from "../engine/image";
import { decodeImage, readPixels } from "../lib/imageFile";
import { deleteImageBlob, getImageBlob, pruneImageBlobs } from "../lib/imageStore";
import type {
  Area, AreaImage, Cells, DialogState, EditorState, HistoryState,
  PersistedState, Stitch, Swatch, Tool, TopView, WorldPoint,
} from "../types";

const STORE_KEY = "crochet-designer-v2";
let _uid = 100;
const uid = (): string => "c" + _uid++;

// ---------- defaults ----------
function defaultPalette(): Swatch[] {
  return DEFAULT_YARNS.map((y) => ({ id: uid(), ...y }));
}
const defaultBg = (): Swatch => ({ id: "bg", color: "#f4efe3", label: "Cream" });

interface InitState {
  bg: Swatch;
  palette: Swatch[];
  activeId: string;
  cells: Cells;
  area: Area | null;
  stitch: Stitch | null;
  tool: Tool;
  image: AreaImage | null;
  /** True when this is the seeded sample (first visit, nothing saved). */
  seeded: boolean;
}

function freshState(withSample: boolean): InitState {
  const palette = defaultPalette();
  const cells = withSample ? sampleCells(palette.map((s) => s.color)) : {};
  return {
    bg: defaultBg(),
    palette,
    activeId: palette[0].id,
    cells,
    area: withSample ? E.computeWorkingArea(cells) : null,
    stitch: null,
    tool: "pencil",
    image: null,
    seeded: withSample,
  };
}

function loadState(): InitState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<PersistedState>;
      if (s && s.palette && s.bg) {
        _uid = (s._uid ?? 1000) + 1;
        // back-compat: derive area from old selection / painted bounds
        const area = s.area !== undefined ? s.area : (s.selection ?? E.computeWorkingArea(s.cells ?? {}));
        return {
          bg: s.bg,
          palette: s.palette,
          activeId: s.activeId ?? s.bg.id,
          cells: s.cells ?? {},
          area: area ?? null,
          stitch: s.stitch ?? null,
          tool: s.tool ?? "pencil",
          // (an image saved before swatch colors were stored is dropped)
          image: s.image?.swatches ? s.image : null,
          seeded: false,
        };
      }
    }
  } catch {
    // corrupt storage -> fall through to fresh seeded state
  }
  return freshState(true);
}

const sameSel = (a: Area | null, b: Area | null): boolean =>
  !!a && !!b && a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;

/** What the upload dialog hands over when the user adds an image. */
export interface ImageUpload {
  blobId: string;
  /** The downscaled image (also what's drawn on the canvas). */
  source: HTMLCanvasElement;
  /** Extracted colors to append (or, with `clear`, to become the palette). */
  colors: Array<{ color: string; label: string }>;
  /** Also clear cells, palette, stitching session, and undo history. */
  clear: boolean;
  /** Working area the image is attached to. */
  area: Area;
}

export interface PatternStore {
  /** True when this session started from the seeded sample motif. */
  seeded: boolean;
  bg: Swatch;
  palette: Swatch[];
  activeId: string;
  setActiveId: Dispatch<SetStateAction<string>>;
  cells: Cells;
  setCells: Dispatch<SetStateAction<Cells>>;
  area: Area | null;
  setArea: Dispatch<SetStateAction<Area | null>>;
  stitch: Stitch | null;
  tool: Tool;
  setTool: Dispatch<SetStateAction<Tool>>;
  topView: TopView;
  setTopView: Dispatch<SetStateAction<TopView>>;
  editor: EditorState | null;
  setEditor: Dispatch<SetStateAction<EditorState | null>>;
  dialog: DialogState | null;
  setDialog: Dispatch<SetStateAction<DialogState | null>>;

  /** Image attached to the working area (null = vanilla area or no area). */
  image: AreaImage | null;
  /** Decoded image for drawing/pixelating; null until loaded from storage. */
  imageSource: HTMLCanvasElement | null;
  /** Cells inside the area are temporarily drawn as background. */
  imageHidden: boolean;
  setImageHidden: Dispatch<SetStateAction<boolean>>;
  /** Pixelate is possible: the image is loaded and some of its swatches still exist. */
  canPixelate: boolean;

  seq: WorldPoint[];
  activeColor: string;
  canBegin: boolean;
  canUndo: boolean;
  canRedo: boolean;
  editingSwatch: Swatch | null;

  pushHistory: (prevCells: Cells) => void;
  commitCells: (prevCells: Cells, nextCells: Cells) => void;
  doUndo: () => void;
  doRedo: () => void;

  updateSwatch: (sw: Swatch) => void;
  deleteSwatch: (id: string) => void;
  setAsBackground: (id: string) => void;
  addSwatch: (rect: DOMRect) => void;
  reorder: (fromId: string, toId: string) => void;
  pickColorAt: (x: number, y: number) => void;

  beginStitching: () => void;
  confirmNewSession: () => void;
  exitStitching: () => void;
  stitchNext: () => void;
  stitchUndo: () => void;

  doNewPattern: () => void;

  attachImage: (upload: ImageUpload) => void;
  removeImage: () => void;
  pixelate: () => void;
}

export function usePatternStore(): PatternStore {
  const init = useMemo(loadState, []);
  const [bg, setBg] = useState(init.bg);
  const [palette, setPalette] = useState(init.palette);
  const [activeId, setActiveId] = useState(init.activeId);
  const [cells, setCells] = useState<Cells>(init.cells);
  const [area, setArea] = useState<Area | null>(init.area);
  const [stitch, setStitch] = useState<Stitch | null>(init.stitch);
  const [tool, setTool] = useState<Tool>(init.tool);
  const [topView, setTopView] = useState<TopView>("design");

  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [image, setImage] = useState<AreaImage | null>(init.image);
  const [imageSource, setImageSource] = useState<HTMLCanvasElement | null>(null);
  const [imageHidden, setImageHidden] = useState(false);

  // latest-value refs so undo/redo/exit can stay referentially stable
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const historyRef = useRef(history);
  historyRef.current = history;
  const stitchRef = useRef(stitch);
  stitchRef.current = stitch;
  const imageRef = useRef(image);
  imageRef.current = image;

  const seq = useMemo(() => (stitch ? E.buildSequence(stitch.sel) : []), [stitch]);

  const activeColor = useMemo(() => {
    if (activeId === bg.id) return bg.color;
    const s = palette.find((p) => p.id === activeId);
    return s ? s.color : palette[0]?.color || "#000";
  }, [activeId, bg, palette]);

  // ---------- persistence ----------
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const payload: PersistedState = { bg, palette, activeId, cells, area, stitch, tool, image, _uid };
        localStorage.setItem(STORE_KEY, JSON.stringify(payload));
      } catch {
        // ignore quota / serialization errors
      }
    }, 250);
    return () => clearTimeout(t);
  }, [bg, palette, activeId, cells, area, stitch, tool, image]);

  // Load the saved image from IndexedDB. If its blob is gone, fall back to a
  // vanilla area at the same footprint. Then drop any orphaned blobs.
  useEffect(() => {
    let alive = true;
    const saved = init.image;
    (async () => {
      if (saved) {
        const blob = await getImageBlob(saved.blobId);
        const source = blob ? await decodeImage(blob).catch(() => null) : null;
        if (!alive || imageRef.current?.blobId !== saved.blobId) return;
        if (source) setImageSource(source);
        else setImage(null);
      }
      if (alive) void pruneImageBlobs([imageRef.current?.blobId]);
    })();
    return () => { alive = false; };
  }, [init]);

  // ---------- history ----------
  const pushHistory = useCallback((prevCells: Cells) => {
    setHistory((h) => ({ past: [...h.past, prevCells].slice(-50), future: [] }));
  }, []);

  const commitCells = useCallback((prevCells: Cells, nextCells: Cells) => {
    setHistory((h) => ({ past: [...h.past, prevCells].slice(-50), future: [] }));
    setCells(nextCells);
  }, []);

  const doUndo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    const prev = h.past[h.past.length - 1];
    setHistory({ past: h.past.slice(0, -1), future: [...h.future, cellsRef.current].slice(-50) });
    setCells(prev);
  }, []);

  const doRedo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    const next = h.future[h.future.length - 1];
    setHistory({ past: [...h.past, cellsRef.current].slice(-50), future: h.future.slice(0, -1) });
    setCells(next);
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
      } else if (topView === "design") {
        if (e.key === "b" || e.key === "p") setTool("pencil");
        else if (e.key === "e") setTool("eraser");
        else if (e.key === "g") setTool("bucket");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo, topView]);

  // ---------- palette ops ----------
  // "bg" is the fixed sentinel id for the background swatch (see defaultBg).
  const updateSwatch = useCallback((sw: Swatch) => {
    if (sw.id === "bg") setBg(sw);
    else setPalette((p) => p.map((s) => (s.id === sw.id ? sw : s)));
  }, []);

  const deleteSwatch = useCallback((id: string) => {
    setPalette((p) => p.filter((s) => s.id !== id));
    setActiveId((cur) => (cur === id ? "bg" : cur));
    setEditor(null);
  }, []);

  // swap swatch `id` with the background (color + label); cells are untouched
  const setAsBackground = useCallback((id: string) => {
    const next = swapWithBackground(bg, palette, activeId, id);
    setBg(next.bg);
    setPalette(next.palette);
    setActiveId(next.activeId);
    setEditor(null);
  }, [bg, palette, activeId]);

  const addSwatch = useCallback((rect: DOMRect) => {
    const ns: Swatch = { id: uid(), color: "#b58b6a", label: "New color" };
    setPalette((p) => [...p, ns]);
    setActiveId(ns.id);
    setEditor({ id: ns.id, rect });
  }, []);

  const reorder = useCallback((fromId: string, toId: string) => {
    setPalette((p) => {
      const arr = [...p];
      const fi = arr.findIndex((s) => s.id === fromId);
      const ti = arr.findIndex((s) => s.id === toId);
      if (fi < 0 || ti < 0) return p;
      const [m] = arr.splice(fi, 1);
      arr.splice(ti, 0, m);
      return arr;
    });
  }, []);

  // eyedropper: pick up an on-canvas color, adding it to the palette if new
  const pickColorAt = useCallback((x: number, y: number) => {
    const col = cells[E.key(x, y)];
    if (!col) { setActiveId(bg.id); return; }
    if (col.toLowerCase() === bg.color.toLowerCase()) { setActiveId(bg.id); return; }
    const exist = palette.find((p) => p.color.toLowerCase() === col.toLowerCase());
    if (exist) { setActiveId(exist.id); return; }
    const ns: Swatch = { id: uid(), color: col, label: "Picked color" };
    setPalette((p) => [...p, ns]);
    setActiveId(ns.id);
  }, [cells, bg, palette]);

  const editingSwatch = useMemo(() => {
    if (!editor) return null;
    if (editor.id === bg.id) return bg;
    return palette.find((s) => s.id === editor.id) ?? null;
  }, [editor, bg, palette]);

  // ---------- begin / exit stitching ----------
  const beginStitching = useCallback(() => {
    if (!area) return;
    if (stitch && stitch.pointer > 0 && !sameSel(stitch.sel, area)) {
      setDialog({ type: "newsession" });
      return;
    }
    if (stitch && sameSel(stitch.sel, area)) {
      setTopView("stitching");
    } else {
      setStitch({ sel: { ...area }, pointer: 0 });
      setTopView("stitching");
    }
  }, [area, stitch]);

  const confirmNewSession = useCallback(() => {
    if (!area) { setDialog(null); return; }
    setStitch({ sel: { ...area }, pointer: 0 });
    setTopView("stitching");
    setDialog(null);
  }, [area]);

  const exitStitching = useCallback(() => {
    setTopView("design");
    const s = stitchRef.current;
    if (s) setArea({ ...s.sel });
  }, []);

  const stitchNext = useCallback(() => {
    setStitch((s) => (s && s.pointer < E.buildSequence(s.sel).length ? { ...s, pointer: s.pointer + 1 } : s));
  }, []);

  const stitchUndo = useCallback(() => {
    setStitch((s) => (s && s.pointer > 0 ? { ...s, pointer: s.pointer - 1 } : s));
  }, []);

  // ---------- uploaded image ----------
  const detachImage = useCallback(() => {
    const prev = imageRef.current;
    setImage(null); setImageSource(null); setImageHidden(false);
    if (prev) void deleteImageBlob(prev.blobId);
  }, []);

  // Attach a new image (replacing any previous one) as the working area.
  // Extracted colors are always appended as new swatches, never merged.
  const attachImage = useCallback((u: ImageUpload) => {
    const prev = imageRef.current;
    const swatches: Swatch[] = u.colors.map((c) => ({ id: uid(), ...c }));
    if (u.clear) {
      setCells({}); setPalette(swatches); setStitch(null);
      setHistory({ past: [], future: [] });
    } else {
      setPalette((p) => [...p, ...swatches]);
    }
    setActiveId(swatches[0]?.id ?? "bg");
    setArea({ ...u.area });
    setImage({
      blobId: u.blobId, w: u.source.width, h: u.source.height,
      swatches: swatches.map(({ id, color }) => ({ id, color })),
    });
    setImageSource(u.source);
    setImageHidden(false);
    setEditor(null);
    if (prev && prev.blobId !== u.blobId) void deleteImageBlob(prev.blobId);
  }, []);

  // The area stays where it is as a vanilla area (auto-grow resumes).
  const removeImage = detachImage;

  const targets = useMemo(() => (image ? pixelateTargets(image.swatches, palette) : []), [image, palette]);
  const canPixelate = !!imageSource && targets.some((t) => t.paint);

  // Repaint every cell in the area from the image, as one undo step.
  const pixelate = useCallback(() => {
    if (!canPixelate || !imageSource || !area) return;
    commitCells(cells, pixelateCells(cells, readPixels(imageSource), area, targets));
    setImageHidden(false);
  }, [canPixelate, imageSource, area, targets, cells, commitCells]);

  // ---------- new pattern ----------
  // Clears the pattern and stitching session; the palette (and background) stay.
  const doNewPattern = useCallback(() => {
    setCells({}); setArea(null); setStitch(null);
    setTool("pencil");
    setHistory({ past: [], future: [] });
    setDialog(null);
    detachImage();
  }, [detachImage]);

  return {
    seeded: init.seeded,
    bg, palette, activeId, setActiveId,
    cells, setCells, area, setArea, stitch, tool, setTool,
    topView, setTopView, editor, setEditor, dialog, setDialog,
    image, imageSource, imageHidden, setImageHidden, canPixelate,
    seq, activeColor, canBegin: !!area, canUndo, canRedo, editingSwatch,
    pushHistory, commitCells, doUndo, doRedo,
    updateSwatch, deleteSwatch, setAsBackground, addSwatch, reorder, pickColorAt,
    beginStitching, confirmNewSession, exitStitching, stitchNext, stitchUndo,
    doNewPattern,
    attachImage, removeImage, pixelate,
  };
}
