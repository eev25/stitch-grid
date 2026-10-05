/* ============================================================
   usePatternStore — root pattern state, history, persistence,
   palette ops, and stitching-session ops.
   Ported from design-reference/main.jsx (state model + logic).
   View/canvas/pointer handling lives in useDesignCanvas instead.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as E from "../engine/engine";
import { swapWithBackground } from "../engine/palette";
import type {
  Area, Cells, DialogState, EditorState, HistoryState,
  PersistedState, Stitch, Swatch, Tool, TopView, WorldPoint,
} from "../types";

const STORE_KEY = "crochet-designer-v2";
let _uid = 100;
const uid = (): string => "c" + _uid++;

// ---------- defaults ----------
function defaultPalette(): Swatch[] {
  return [
    { id: uid(), color: "#c8553d", label: "Terracotta" },
    { id: uid(), color: "#2e2b29", label: "Charcoal" },
    { id: uid(), color: "#3e5c76", label: "Denim" },
    { id: uid(), color: "#e0a526", label: "Mustard" },
    { id: uid(), color: "#6e8b5b", label: "Sage" },
    { id: uid(), color: "#a89b8c", label: "Warm Gray" },
  ];
}
const defaultBg = (): Swatch => ({ id: "bg", color: "#f4efe3", label: "Cream" });

// sample heart motif (11x9), painted terracotta
function sampleCells(color: string): Cells {
  const rows = [
    [1, 2, 3, 7, 8, 9],
    [0, 1, 2, 3, 4, 6, 7, 8, 9, 10],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [2, 3, 4, 5, 6, 7, 8],
    [3, 4, 5, 6, 7],
    [4, 5, 6],
    [5],
  ];
  const cells: Cells = {};
  rows.forEach((cols, r) => {
    cols.forEach((c) => { cells[E.key(c - 5, r - 4)] = color; });
  });
  return cells;
}

interface InitState {
  name: string;
  bg: Swatch;
  palette: Swatch[];
  activeId: string;
  cells: Cells;
  area: Area | null;
  stitch: Stitch | null;
  tool: Tool;
}

function freshState(withSample: boolean): InitState {
  const palette = defaultPalette();
  const cells = withSample ? sampleCells(palette[0].color) : {};
  return {
    name: "Untitled Pattern",
    bg: defaultBg(),
    palette,
    activeId: palette[0].id,
    cells,
    area: withSample ? E.computeWorkingArea(cells) : null,
    stitch: null,
    tool: "pencil",
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
          name: s.name ?? "Untitled Pattern",
          bg: s.bg,
          palette: s.palette,
          activeId: s.activeId ?? s.bg.id,
          cells: s.cells ?? {},
          area: area ?? null,
          stitch: s.stitch ?? null,
          tool: s.tool ?? "pencil",
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

export interface PatternStore {
  name: string;
  setName: Dispatch<SetStateAction<string>>;
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
}

export function usePatternStore(): PatternStore {
  const init = useMemo(loadState, []);
  const [name, setName] = useState(init.name);
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

  // latest-value refs so undo/redo/exit can stay referentially stable
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const historyRef = useRef(history);
  historyRef.current = history;
  const stitchRef = useRef(stitch);
  stitchRef.current = stitch;

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
        const payload: PersistedState = { name, bg, palette, activeId, cells, area, stitch, tool, _uid };
        localStorage.setItem(STORE_KEY, JSON.stringify(payload));
      } catch {
        // ignore quota / serialization errors
      }
    }, 250);
    return () => clearTimeout(t);
  }, [name, bg, palette, activeId, cells, area, stitch, tool]);

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

  // ---------- new pattern ----------
  const doNewPattern = useCallback(() => {
    const f = freshState(false);
    setName(f.name); setBg(f.bg); setPalette(f.palette); setActiveId(f.activeId);
    setCells({}); setArea(null); setStitch(null);
    setTool("pencil");
    setHistory({ past: [], future: [] });
    setDialog(null);
  }, []);

  return {
    name, setName, bg, palette, activeId, setActiveId,
    cells, setCells, area, setArea, stitch, tool, setTool,
    topView, setTopView, editor, setEditor, dialog, setDialog,
    seq, activeColor, canBegin: !!area, canUndo, canRedo, editingSwatch,
    pushHistory, commitCells, doUndo, doRedo,
    updateSwatch, deleteSwatch, setAsBackground, addSwatch, reorder, pickColorAt,
    beginStitching, confirmNewSession, exitStitching, stitchNext, stitchUndo,
    doNewPattern,
  };
}
