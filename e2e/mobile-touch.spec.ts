/* ============================================================
   mobile-touch.spec.ts — on a phone-sized viewport, a tap must
   paint the cell drawn under the finger. Guards against the
   canvas being sized from a different box than the one pointer
   mapping reads (which squashes the drawing and shifts paint
   upward, worst near the bottom of the canvas).
   ============================================================ */
import { test, expect } from "@playwright/test";

const STORAGE_KEY = "crochet-designer-v2";

test.use({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

test("a tap near the bottom of the canvas paints the cell under the finger", async ({ page }) => {
  // Start from an empty pattern with no working area, so the view is the
  // default: origin centered, 30px cells.
  await page.goto("/");
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).not.toBeNull();
  const store = await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    s.cells = {}; s.area = null;
    localStorage.setItem(k, JSON.stringify(s));
    return s;
  }, STORAGE_KEY);
  await page.reload();

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;

  // The drawing buffer must have the canvas's on-screen aspect ratio,
  // otherwise the browser stretches the drawing away from the touch coords.
  const buf = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
  expect(buf.w / buf.h).toBeCloseTo(box.width / box.height, 2);

  // Tap the center of a cell ~85% of the way down the canvas, where the
  // offset from a squashed drawing would be largest.
  const CELL = 30;
  const col = -3;
  const row = Math.floor((box.height * 0.85 - box.height / 2) / CELL);
  const lx = box.width / 2 + col * CELL + CELL / 2;
  const ly = box.height / 2 + row * CELL + CELL / 2;
  await page.touchscreen.tap(box.x + lx, box.y + ly);

  const active = store.palette.find((s: { id: string }) => s.id === store.activeId).color as string;
  expect(active.toLowerCase()).not.toBe(store.bg.color.toLowerCase());

  // Read back the pixel drawn under the finger (allowing for color rounding).
  const [er, eg, eb] = hexToRgb(active);
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement, [x, y]) => {
    const r = c.getBoundingClientRect();
    const px = c.getContext("2d")!.getImageData(
      Math.floor(x * c.width / r.width), Math.floor(y * c.height / r.height), 1, 1).data;
    return [px[0], px[1], px[2]];
  }, [lx, ly]).then(([r, g, b]) => Math.max(Math.abs(r - er), Math.abs(g - eg), Math.abs(b - eb))))
    .toBeLessThanOrEqual(2);
});
