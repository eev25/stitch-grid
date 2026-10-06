/* ============================================================
   imageFile.ts — browser-side image handling for uploads:
   decode, downscale, read pixels, and re-encode for storage.
   ============================================================ */

/** Upload types we accept (no SVG). */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** Stored images are downscaled so their long edge is at most this. */
export const MAX_IMAGE_EDGE = 1024;
/** Palette extraction runs on a copy downscaled to about this long edge. */
export const EXTRACT_EDGE = 100;

/** Draw `src` into a new canvas, scaled down (never up) to fit `maxEdge`. */
export function scaledCanvas(src: CanvasImageSource, sw: number, sh: number, maxEdge: number): HTMLCanvasElement {
  const s = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * s));
  canvas.height = Math.max(1, Math.round(sh * s));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Decode an image blob into a canvas no larger than `maxEdge`. A canvas (not
 * an <img>) so the result stays drawable after the object URL is revoked.
 */
export async function decodeImage(blob: Blob, maxEdge = MAX_IMAGE_EDGE): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return scaledCanvas(img, img.naturalWidth, img.naturalHeight, maxEdge);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function readPixels(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
}

function hasTransparency(px: ImageData): boolean {
  for (let i = 3; i < px.data.length; i += 4) if (px.data[i] < 255) return true;
  return false;
}

/** Re-encode for storage: WebP at 0.85, or PNG when the image has any transparency. */
export function encodeImage(canvas: HTMLCanvasElement): Promise<Blob> {
  const type = hasTransparency(readPixels(canvas)) ? "image/png" : "image/webp";
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed"))), type, 0.85);
  });
}
