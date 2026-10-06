/* ============================================================
   Shared domain types for the Crochet Pattern Designer.
   ============================================================ */

/** A point in world (grid) coordinates. */
export interface WorldPoint {
  x: number;
  y: number;
}

/** A point in screen (canvas pixel) coordinates. */
export interface ScreenPoint {
  sx: number;
  sy: number;
}

/** Painted cells, keyed by `"x,y"` world coordinates -> hex color. */
export type Cells = Record<string, string>;

/** Working-area bounding box (inclusive world cells). */
export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Pan/zoom view model. panX/panY = screen px of the world origin. */
export interface View {
  panX: number;
  panY: number;
  cell: number;
}

/** A palette swatch (yarn color or the pinned background). */
export interface Swatch {
  id: string;
  color: string;
  label: string;
}

/** Active stitching session: selection + pointer (index of current stitch). */
export interface Stitch {
  sel: Area;
  pointer: number;
}

export type Tool = "pencil" | "eraser" | "bucket" | "line" | "rect";

export type TopView = "design" | "stitching";

/** Undo/redo stacks of previous `cells` snapshots (capped at 50). */
export interface HistoryState {
  past: Cells[];
  future: Cells[];
}

/** Open color-editor popover target. */
export interface EditorState {
  id: string;
  rect: DOMRect;
}

/** Active modal dialog. */
export interface DialogState {
  type: "new" | "newsession";
}

/** Handle definition for working-area resize handles (8 points). */
export interface HandleDef {
  ex: "min" | "max" | null;
  ey: "min" | "max" | null;
}

/**
 * An uploaded image attached to the working area (drawn stretched over it).
 * The image itself lives in IndexedDB under `blobId`; this is its metadata.
 */
export interface AreaImage {
  blobId: string;
  /** Pixel size of the stored (downscaled) image. */
  w: number;
  h: number;
  /**
   * Swatches extracted for this image, each with its color as of Add image
   * (after any edits in the upload dialog). Pixelate matches cells against
   * these saved colors, then paints with the swatch's current color, or
   * clears the cell if the swatch has been deleted.
   */
  swatches: ImageSwatch[];
}

export interface ImageSwatch {
  id: string;
  color: string;
}

/** Full persisted pattern state (localStorage shape). */
export interface PersistedState {
  bg: Swatch;
  palette: Swatch[];
  activeId: string;
  cells: Cells;
  area: Area | null;
  stitch: Stitch | null;
  tool: Tool;
  image?: AreaImage | null;
  _uid: number;
  /** Back-compat: older saves stored a `selection` instead of `area`. */
  selection?: Area | null;
}
