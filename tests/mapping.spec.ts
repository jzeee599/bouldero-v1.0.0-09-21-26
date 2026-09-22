import { test, expect, type Page } from "@playwright/test";

async function upload(page: Page, width = 800, height = 1200) {
  await page.goto("/");
  await page.getByRole("button", { name: /New project/ }).click();
  // A generated image with visible hold-like dots makes tests self-contained.
  const bytes = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#b8b2a0";
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 15; i++) {
        ctx.fillStyle = i % 2 ? "#915574" : "#b3c269";
        ctx.beginPath();
        ctx.ellipse(
          width * (0.2 + (i % 3) * 0.28),
          height * (0.12 + Math.floor(i / 3) * 0.17),
          27,
          15,
          0.4,
          0,
          7,
        );
        ctx.fill();
      }
      return canvas.toDataURL("image/jpeg").split(",")[1];
    },
    { width, height },
  );
  await page
    .getByLabel("Choose a photo", { exact: true })
    .setInputFiles({
      name: "route.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(bytes, "base64"),
    });
  await expect(page.getByTestId("photo-map").locator("img")).toBeVisible();
  await page
    .getByTestId("photo-map")
    .locator("img")
    .evaluate((img: HTMLImageElement) => img.decode());
}
async function add(page: Page, x: number, y: number) {
  const map = page.getByTestId("photo-map");
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  await map
    .locator("img")
    .click({ position: { x: box.width * x, y: box.height * y } });
}
async function assertPosition(page: Page, index: number, x: number, y: number) {
  const map = (await page.getByTestId("photo-map").boundingBox())!;
  const marker = (await page.getByTestId(`hold-${index}`).boundingBox())!;
  expect(
    Math.abs((marker.x + marker.width / 2 - map.x) / map.width - x),
  ).toBeLessThan(0.005);
  expect(
    Math.abs((marker.y + marker.height / 2 - map.y) / map.height - y),
  ).toBeLessThan(0.005);
}

test("15 holds survive save, reload, and phone/desktop/landscape resizing", async ({
  page,
}) => {
  await upload(page);
  const points = Array.from({ length: 15 }, (_, i) => ({
    x: 0.2 + (i % 3) * 0.28,
    y: 0.12 + Math.floor(i / 3) * 0.17,
  }));
  for (const point of points) await add(page, point.x, point.y);
  await expect(page.getByRole("button", { name: /^Hold / })).toHaveCount(15);
  await page.getByLabel("Project name").fill("Purple patience");
  await page.getByLabel("Grade optional").fill("V5");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Done · Save project/ }).click();
  await expect(
    page.getByRole("heading", { name: "Purple patience" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Purple patience/ }).click();
  for (const size of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
    { width: 844, height: 390 },
    { width: 320, height: 700 },
  ]) {
    await page.setViewportSize(size);
    for (const [i, point] of points.entries())
      await assertPosition(page, i + 1, point.x, point.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByRole("button", { name: "Hold 15, TOP", exact: true }),
  ).toBeVisible();
});

test("drag, keyboard nudge, delete, undo, and TOP semantics", async ({
  page,
}) => {
  await upload(page, 1200, 800);
  await add(page, 0.2, 0.3);
  await add(page, 0.5, 0.5);
  await add(page, 0.8, 0.7);
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "Hold 3, TOP", exact: true }),
  ).toBeVisible();
  const marker = page.getByTestId("hold-1");
  await marker.scrollIntoViewIfNeeded();
  let box = (await page.getByTestId("photo-map").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.4, {
    steps: 5,
  });
  await page.mouse.up();
  await assertPosition(page, 1, 0.35, 0.4);
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await assertPosition(page, 1, 0.355, 0.4);
  await page.getByTestId("hold-2").click();
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(
    page.getByRole("button", { name: "Hold 2, TOP", exact: true }),
  ).toBeVisible();
  await add(page, 0.5, 0.8);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button", { name: "Undo last hold" }).click();
  await expect(page.getByRole("button", { name: /^Hold / })).toHaveCount(2);
  await page.getByTestId("hold-1").scrollIntoViewIfNeeded();
  box = (await page.getByTestId("photo-map").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.355, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x - 15, box.y + box.height * 0.2, { steps: 5 });
  await page.mouse.up();
  await assertPosition(page, 1, 0, 0.2);
});

test("requires a name and hold; failed persistence retains editable draft", async ({
  page,
}) => {
  await upload(page);
  const save = page.getByRole("button", { name: /Done · Save project/ });
  await expect(save).toBeDisabled();
  await page.getByLabel("Project name").fill("Retry route");
  await expect(save).toBeDisabled();
  await add(page, 0.5, 0.5);
  await expect(save).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = original;
      throw new Error("Test: storage full");
    };
  });
  await save.click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "storage full",
  );
  await expect(page.getByLabel("Project name")).toHaveValue("Retry route");
  await expect(page.getByTestId("hold-1")).toBeVisible();
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Retry route" }),
  ).toBeVisible();
});

test("invalid image reports an actionable error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /New project/ }).click();
  await page
    .getByLabel("Choose a photo", { exact: true })
    .setInputFiles({
      name: "broken.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not an image"),
    });
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "could not be opened",
  );
});
