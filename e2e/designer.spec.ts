/* ============================================================
   designer.spec.ts — Playwright e2e flows for the Crochet Pattern
   Designer: initial load, painting + persistence, and the guided
   Stitching Mode (Begin -> Next -> Undo), plus the New Pattern
   reset dialog.
   ============================================================ */
import { test, expect, type Page } from "@playwright/test";

const STORAGE_KEY = "crochet-designer-v2";

interface PersistedShape {
  cells: Record<string, string>;
  area: { x0: number; y0: number; x1: number; y1: number } | null;
}

async function readStore(page: Page): Promise<PersistedShape | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PersistedShape) : null;
}

test.describe("Crochet Pattern Designer", () => {
  test("loads with the seeded heart pattern and Begin Stitching enabled", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("canvas")).toBeVisible();
    // The seeded heart motif fills the working area, so stitching can begin
    // immediately and the empty-canvas hint should not be shown.
    await expect(page.getByRole("button", { name: "Begin Stitching" })).toBeEnabled();
    await expect(page.getByText("Pick a color, then paint your first stitch")).toHaveCount(0);
  });

  test("paints a cell with the active palette color and persists it after reload", async ({ page }) => {
    await page.goto("/");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas has no bounding box");

    // Select the "Charcoal" swatch in the palette sidebar.
    await page.getByText("Charcoal", { exact: true }).click();

    // Paint a cell well outside the seeded heart's bounding box (the heart
    // spans world x in [-5, 5]; clicking ~200px right of center at the
    // default 30px cell size lands on world cell (6, 0)).
    await page.mouse.click(box.x + box.width / 2 + 200, box.y + box.height / 2);

    // Wait for the ~250ms debounced localStorage write to pick up the new cell.
    await expect.poll(async () => {
      const store = await readStore(page);
      return store ? Object.values(store.cells).includes("#2e2b29") : false;
    }, { timeout: 2000 }).toBe(true);

    await page.reload();

    const store = await readStore(page);
    expect(store).not.toBeNull();
    expect(Object.values(store!.cells)).toContain("#2e2b29");
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("New pattern resets the canvas; a single painted cell can be stitched via Next/Undo", async ({ page }) => {
    await page.goto("/");

    // Open and confirm the destructive "new pattern" dialog.
    await page.locator('button[title="New pattern"]').click();
    await expect(page.getByText("Start a new pattern?")).toBeVisible();
    await page.getByRole("button", { name: "Erase & start new" }).click();

    // Empty canvas -> hint shown, Begin Stitching disabled (no working area yet).
    await expect(page.getByText("Pick a color, then paint your first stitch")).toBeVisible();
    await expect(page.getByRole("button", { name: "Begin Stitching" })).toBeDisabled();

    // Paint a single cell at the canvas center (world cell 0,0).
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas has no bounding box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.getByText("Pick a color, then paint your first stitch")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Begin Stitching" })).toBeEnabled();

    // A single-cell working area means a single-stitch sequence.
    await page.getByRole("button", { name: "Begin Stitching" }).click();
    await expect(page.getByRole("button", { name: "Exit Stitching" })).toBeVisible();

    const undoBtn = page.getByRole("button", { name: "Undo" });
    const nextBtn = page.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeVisible();
    await expect(undoBtn).toBeDisabled();

    // Stitch the only cell -> pattern complete.
    await nextBtn.click();
    const doneBtn = page.getByRole("button", { name: "All stitched" });
    await expect(doneBtn).toBeVisible();
    await expect(doneBtn).toBeDisabled();
    await expect(undoBtn).toBeEnabled();

    // Undo -> back to the single remaining stitch.
    await undoBtn.click();
    await expect(nextBtn).toBeVisible();
    await expect(undoBtn).toBeDisabled();
  });
});
