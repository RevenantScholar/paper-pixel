import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { worksheetSvg, layout } from "../src/core/worksheet";

async function fixture(n = 4) {
  const l = layout("A4", n);
  let cells = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      cells += `<rect x="${l.x + (x * l.side) / n + 0.5}" y="${l.y + (y * l.side) / n + 0.5}" width="${l.side / n - 1}" height="${l.side / n - 1}" fill="${x < n / 2 ? `rgb(${20 + y * 3},${170 + y * 3},66)` : `rgb(37,${77 + y * 3},${204 - y * 3})`}"/>`;
  const svg = worksheetSvg("A4", n).replace(
    "<!-- drawing -->",
    cells + "<!-- drawing -->",
  );
  return sharp(Buffer.from(svg), { density: 160 }).png().toBuffer();
}
async function load(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "Scan drawing", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "worksheet.png",
    mimeType: "image/png",
    buffer: await fixture(),
  });
  await expect(
    page.getByRole("button", { name: "Convert to pixels", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Convert to pixels", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
}
// @spec WORKSHEET-001, WORKSHEET-002, WORKSHEET-003, WORKSHEET-004, WORKSHEET-005, WORKSHEET-012, WORKSHEET-020, WORKSHEET-021
test("configure and print a full-page worksheet", async ({ page }) => {
  await page.goto("/");
  const github = page.getByRole("link", {
    name: "GitHub repository (opens in a new tab)",
  });
  await expect(github).toHaveAttribute(
    "href",
    "https://github.com/RevenantScholar/paper-pixel",
  );
  await expect(github).toHaveAttribute("target", "_blank");
  await expect(github).toHaveAttribute("rel", "noopener noreferrer");
  await page.screenshot({
    path: `test-results/create-desktop-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/");
  await expect(page.getByLabel("Grid size")).toHaveValue("32");
  await page.getByLabel("Grid size").fill("1");
  await expect(
    page.getByRole("button", { name: "Print worksheet", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Grid size").fill("64");
  await expect(page.getByText(/smaller cells need/i)).toBeVisible();
  await page.getByLabel("Paper size").selectOption("A4");
  await page.evaluate(() => {
    (window as any).__printed = false;
    window.print = () => {
      (window as any).__printed = true;
    };
  });
  await page
    .getByRole("button", { name: "Print worksheet", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__printed)).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-sheet > svg")).toBeVisible();
  await expect(github).toBeHidden();
  if (test.info().project.name === "chromium") {
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect(
      (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
    ).toBe(1);
  }
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(github).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: `test-results/create-mobile-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
// @spec SCANNER-008, SCANNER-013, SCANNER-014, SCANNER-016, SCANNER-018, SCANNER-020, SCANNER-025, SCANNER-027, SCANNER-028, ARTWORK-001, ARTWORK-002, ARTWORK-004, ARTWORK-019, ARTWORK-020, ARTWORK-021, ARTWORK-022, ARTWORK-025
test("scan actual markers, infer green/blue, and download a scaled PNG", async ({
  page,
}) => {
  await load(page);
  await page.getByLabel("Palette size").selectOption("2");
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("2 colors", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/scanned-artwork-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Export scale").fill("3");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("pixel-art-4x4-3x.png");
  const decoded = await sharp((await file.path())!)
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(decoded.info.width).toBe(12);
  expect(decoded.info.height).toBe(12);
  const unique = new Set<string>();
  for (let i = 0; i < decoded.data.length; i += decoded.info.channels)
    unique.add([...decoded.data.subarray(i, i + 3)].join(","));
  expect(unique.size).toBe(2);
});
// @spec ARTWORK-002, ARTWORK-003, ARTWORK-014, ARTWORK-016, ARTWORK-020, ARTWORK-026, ARTWORK-027
test("custom three-color palette exports and restores from cache", async ({
  page,
}) => {
  await load(page);
  await page.getByLabel("Palette size").selectOption("custom");
  await page.getByLabel("Custom color count").fill("3");
  await expect(page.getByText("3 colors", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const file = await download;
  const { data, info } = await sharp((await file.path())!)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([4, 4]);
  const unique = new Set<string>();
  for (let i = 0; i < data.length; i += 3)
    unique.add([...data.subarray(i, i + 3)].join(","));
  expect(unique.size).toBe(3);
  await page.getByLabel("Custom color count").fill("5");
  await expect(page.getByText("5 colors", { exact: true })).toBeVisible();
  await page.getByLabel("Custom color count").fill("3");
  await expect(page.getByText("Cached palette", { exact: true })).toBeVisible();
  await expect(page.getByText("3 colors", { exact: true })).toBeVisible();
});
// @spec WORKSHEET-017, WORKSHEET-018, ARTWORK-014, ARTWORK-016, ARTWORK-026, ARTWORK-027, ARTWORK-028, ARTWORK-029, ARTWORK-031, SCANNER-031
test("compare cached palettes and preserve work across navigation", async ({
  page,
}) => {
  await load(page);
  await page.getByLabel("Palette size").selectOption("2");
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Palette size").selectOption("4");
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Palette size").selectOption("2");
  await expect(page.getByText("Cached palette", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Create worksheet", exact: true })
    .click();
  await page.getByLabel("Grid size").fill("16");
  await page.getByRole("button", { name: "Scan drawing", exact: true }).click();
  await expect(page.getByLabel("Scan grid size")).toHaveValue("4");
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Scan drawing", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toHaveCount(0);
});
// @spec SCANNER-001, SCANNER-003, SCANNER-007, SCANNER-017, SCANNER-021
test("camera and import errors recover without a paper input", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!navigator.mediaDevices)
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        configurable: true,
      });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Scan drawing", exact: true }).click();
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("bad"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.getByLabel("Paper size").count()).toBe(0);
});
// @spec WORKSHEET-019
test("keeps processing local", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5173")
    )
      external.push(r.url());
  });
  await load(page);
  expect(external).toEqual([]);
});

// @spec ARTWORK-023, ARTWORK-024
test("export failure preserves artwork and changed settings discard pending PNG", async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() => {
    (window as any).__encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      cb(null);
    };
  });
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("lower scale");
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      (window as any).__callback = cb;
    };
  });
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  await page.getByLabel("Export scale").fill("2");
  await page.evaluate(() => {
    (window as any).__callback(new Blob(["ignored"], { type: "image/png" }));
    HTMLCanvasElement.prototype.toBlob = (window as any).__encode;
  });
  await expect(
    page.getByRole("button", { name: "Download PNG", exact: true }),
  ).toBeEnabled();
  expect(downloads).toBe(0);
});
// @spec SCANNER-002, SCANNER-004, SCANNER-012
test("captures a camera frame and stops tracks including on navigation", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "chromium",
    "Canvas-based camera fixture is Chromium-only.",
  );
  await page.addInitScript(() => {
    (window as any).__stops = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 400, 400);
        const s = canvas.captureStream(10);
        for (const t of s.getTracks()) {
          const stop = t.stop.bind(t);
          t.stop = () => {
            (window as any).__stops++;
            stop();
          };
        }
        return s;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Scan drawing", exact: true }).click();
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.videoWidth),
    )
    .toBe(400);
  await page
    .getByRole("button", { name: "Capture drawing", exact: true })
    .click();
  await expect(page.getByLabel("Scan grid size")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__stops)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Retake", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
  const before = await page.evaluate(() => (window as any).__stops);
  await page
    .getByRole("button", { name: "Create worksheet", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__stops)).toBeGreaterThan(
    before,
  );
});
// @spec SCANNER-004
test("stops a camera stream that arrives after leaving Scan", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).__lateStops = 0;
    const getUserMedia = () =>
      new Promise((resolve) => {
        (window as any).__resolveCamera = () =>
          resolve({
            getTracks: () => [
              {
                stop: () => {
                  (window as any).__lateStops++;
                },
              },
            ],
          });
      });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
  });
  await page.getByRole("button", { name: "Scan drawing", exact: true }).click();
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  await page
    .getByRole("button", { name: "Create worksheet", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).__resolveCamera))
    .toBe("function");
  await page.evaluate(() => (window as any).__resolveCamera());
  await expect
    .poll(() => page.evaluate(() => (window as any).__lateStops))
    .toBe(1);
});

// @spec SCANNER-006, SCANNER-007, SCANNER-008, SCANNER-013, SCANNER-018
for (const format of ["jpeg", "webp"] as const)
  test(`imports ${format} photos with correct dimensions and orientation`, async ({
    page,
  }) => {
    const base = await fixture();
    const buffer =
      format === "jpeg"
        ? await sharp(base)
            .withMetadata({ orientation: 6 })
            .jpeg({ quality: 95 })
            .toBuffer()
        : await sharp(base).webp({ quality: 95 }).toBuffer();
    await page.goto("/");
    await page
      .getByRole("button", { name: "Scan drawing", exact: true })
      .click();
    await page.locator("input[type=file]").setInputFiles({
      name: `photo.${format}`,
      mimeType: `image/${format}`,
      buffer,
    });
    await expect(
      page.getByRole("button", { name: "Convert to pixels", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    await expect(page.getByLabel("Scan grid size")).toHaveValue("4");
    await page
      .getByRole("button", { name: "Convert to pixels", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Download PNG", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
  });
