/* ============================================================
   image-upload.spec.ts — Playwright e2e for uploading an image:
   the upload dialog (color stepper, clear option), attaching the
   image as the working area, Pixelate + undo, dragging the box,
   persistence through IndexedDB, Remove, and the missing-blob
   fallback.
   ============================================================ */
import { test, expect, type Page } from "@playwright/test";
import { makePng } from "./png";

const STORAGE_KEY = "crochet-designer-v2";

interface Store {
  palette: Array<{ id: string; color: string; label: string }>;
  cells: Record<string, string>;
  area: { x0: number; y0: number; x1: number; y1: number } | null;
  image: { blobId: string; w: number; h: number; swatches: Array<{ id: string; color: string }> } | null;
}

const readStore = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), STORAGE_KEY) as Promise<Store | null>;

const blobIds = (page: Page) => page.evaluate(() => new Promise<string[]>((resolve) => {
  const req = indexedDB.open("stitch-grid", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("images");
  req.onsuccess = () => {
    const keys = req.result.transaction("images").objectStore("images").getAllKeys();
    keys.onsuccess = () => { resolve(keys.result.map(String)); req.result.close(); };
  };
}));

// 60 x 30: left half red, right half blue -> a 40 x 20 area.
const twoTone = makePng(60, 30, (x) => (x < 30 ? [224, 32, 32, 255] : [32, 64, 224, 255]));

async function upload(page: Page, buffer: Buffer, name = "two-tone.png", mimeType = "image/png") {
  await page.getByTestId("image-upload-input").setInputFiles({ name, mimeType, buffer });
}

test("upload an image, pixelate it, move it, and remove it", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => readStore(page)).not.toBeNull();

  await upload(page, twoTone);
  const dialog = page.getByRole("dialog", { name: "Upload image" });
  await expect(dialog).toBeVisible();

  // Default is 4 colors, but the image only has 2.
  await expect(dialog.locator("output")).toHaveText("4");
  await expect(dialog.getByText("Only 2 distinct colors found.")).toBeVisible();
  await dialog.getByRole("button", { name: "Fewer colors" }).click();
  await dialog.getByRole("button", { name: "Fewer colors" }).click();
  await expect(dialog.locator("output")).toHaveText("2");

  // The last checked color can't be unchecked.
  const checks = dialog.getByRole("list", { name: "Extracted colors" }).getByRole("checkbox");
  await checks.nth(1).uncheck();
  await expect(checks.nth(0)).toBeDisabled();
  await checks.nth(1).check();

  // The seeded sample has cells, so "Clear existing work" is offered.
  await dialog.getByLabel("Clear existing work").check();
  await expect(dialog.getByText("This can't be undone.")).toBeVisible();
  await dialog.getByRole("button", { name: "Add image" }).click();
  await expect(dialog).toHaveCount(0);

  const bar = page.getByRole("toolbar", { name: "Image" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("40 × 20");

  await expect.poll(async () => (await readStore(page))?.image?.blobId).toBeTruthy();
  const s1 = (await readStore(page))!;
  expect(s1.palette.map((p) => p.label)).toEqual(["Image color 1", "Image color 2"]);
  expect(s1.image!.swatches).toEqual(s1.palette.map(({ id, color }) => ({ id, color })));
  expect(s1.cells).toEqual({});
  expect(s1.area!.x1 - s1.area!.x0 + 1).toBe(40);
  expect(s1.area!.y1 - s1.area!.y0 + 1).toBe(20);
  expect(await blobIds(page)).toEqual([s1.image!.blobId]);

  // Pixelate fills all 800 cells with the two extracted colors; one undo reverts it.
  await bar.getByRole("button", { name: "Pixelate" }).click();
  await expect.poll(async () => Object.keys((await readStore(page))!.cells).length).toBe(800);
  const used = new Set(Object.values((await readStore(page))!.cells));
  expect([...used].sort()).toEqual(s1.palette.map((p) => p.color).sort());
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => Object.keys((await readStore(page))!.cells).length).toBe(0);

  // Hide / Show toggles.
  await bar.getByRole("button", { name: "Hide cells" }).click();
  await expect(bar.getByRole("button", { name: "Show cells" })).toBeVisible();
  await bar.getByRole("button", { name: "Show cells" }).click();

  // Dragging the grip moves the box by whole cells, keeping its size.
  const grip = bar.getByRole("button", { name: "Drag image area" });
  const g = (await grip.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2 + 120, g.y + g.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await readStore(page))!.area!.x0).toBeGreaterThan(s1.area!.x0);
  const s2 = (await readStore(page))!;
  expect(s2.area!.y0).toBeGreaterThan(s1.area!.y0);
  expect(s2.area!.x1 - s2.area!.x0).toBe(39);
  expect(s2.cells).toEqual({});

  // Painting outside the box doesn't grow it while the image is attached.
  const canvas = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(canvas.x + 20, canvas.y + canvas.height - 20);
  await expect.poll(async () => Object.keys((await readStore(page))!.cells).length).toBe(1);
  expect((await readStore(page))!.area).toEqual(s2.area);

  // The image survives a reload (blob comes back from IndexedDB).
  await page.reload();
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button", { name: "Pixelate" })).toBeEnabled();

  // Remove detaches the image and deletes the blob; the area stays put.
  await bar.getByRole("button", { name: "Remove image" }).click();
  await expect(bar).toHaveCount(0);
  await expect.poll(async () => (await readStore(page))!.image).toBeNull();
  expect((await readStore(page))!.area).toEqual(s2.area);
  await expect.poll(() => blobIds(page)).toEqual([]);
});

test("Pixelate paints edited swatches over their original regions and clears deleted ones", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => readStore(page)).not.toBeNull();
  await upload(page, twoTone);
  const dialog = page.getByRole("dialog", { name: "Upload image" });
  await dialog.getByRole("button", { name: "Fewer colors" }).click();
  await dialog.getByRole("button", { name: "Fewer colors" }).click();
  await dialog.getByLabel("Clear existing work").check();
  await dialog.getByRole("button", { name: "Add image" }).click();
  await expect.poll(async () => (await readStore(page))?.image?.swatches.length).toBe(2);

  // Palette is [Image color 1, Image color 2]; work out which is red (left half).
  const s0 = (await readStore(page))!;
  const redIdx = s0.palette.findIndex((p) => parseInt(p.color.slice(1, 3), 16) > 128);
  const blueIdx = 1 - redIdx;
  // Edit buttons: background first, then the palette in order.
  const editBtn = (i: number) => page.locator("aside").getByTitle("Edit color").nth(i + 1);

  // Recolor the red swatch green...
  await editBtn(redIdx).click();
  await page.locator('input[maxlength="7"]').fill("#00ff00");
  await page.getByRole("button", { name: "Done" }).click();
  // ...and delete the blue one.
  await editBtn(blueIdx).click();
  await page.getByTitle("Delete swatch").click();
  await expect.poll(async () => (await readStore(page))!.palette.length).toBe(1);

  await page.getByRole("toolbar", { name: "Image" }).getByRole("button", { name: "Pixelate" }).click();
  await expect.poll(async () => Object.keys((await readStore(page))!.cells).length).toBe(400);
  const { cells, area } = (await readStore(page))!;
  expect(new Set(Object.values(cells))).toEqual(new Set(["#00ff00"]));
  // Only the left (formerly red) half is painted; the blue half is background.
  for (const k of Object.keys(cells)) expect(Number(k.split(",")[0])).toBeLessThan(area!.x0 + 20);
});

test("appends extracted colors to the palette without clearing", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => readStore(page)).not.toBeNull();
  const before = (await readStore(page))!;

  await upload(page, twoTone);
  const dialog = page.getByRole("dialog", { name: "Upload image" });
  await dialog.getByRole("button", { name: "Add image" }).click();
  await expect(page.getByRole("toolbar", { name: "Image" })).toBeVisible();

  await expect.poll(async () => (await readStore(page))!.palette.length).toBe(before.palette.length + 2);
  const after = (await readStore(page))!;
  expect(after.palette.slice(0, before.palette.length)).toEqual(before.palette);
  expect(after.palette.slice(-2).map((p) => p.label)).toEqual(["Image color 1", "Image color 2"]);
  expect(after.cells).toEqual(before.cells);
});

test("falls back to a vanilla area when the stored image is missing", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => readStore(page)).not.toBeNull();
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    s.image = { blobId: "img-missing", w: 60, h: 30, swatches: [] };
    localStorage.setItem(k, JSON.stringify(s));
  }, STORAGE_KEY);
  await page.reload();
  await expect.poll(async () => (await readStore(page))!.image).toBeNull();
  await expect(page.getByRole("toolbar", { name: "Image" })).toHaveCount(0);
  expect((await readStore(page))!.area).not.toBeNull();
});

test("rejects unsupported file types", async ({ page }) => {
  await page.goto("/");
  await upload(page, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "x.svg", "image/svg+xml");
  const dialog = page.getByRole("dialog", { name: "Upload image" });
  await expect(dialog.getByRole("alert")).toContainText("PNG, JPEG, or WebP");
  await expect(dialog.getByRole("button", { name: "Add image" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});
