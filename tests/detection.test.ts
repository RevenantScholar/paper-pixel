import { it, expect } from "vitest";
import sharp from "sharp";
import { worksheetSvg, layout } from "../src/core/worksheet";
import { detectGrid } from "../src/core/detection";
import { sampleGrid } from "../src/core/geometry";
async function raster(svg: string, rotate = 0, resize = 1000) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 150 })
    .rotate(rotate, { background: "white" })
    .resize({ width: resize })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  };
}
// @spec WORKSHEET-009, WORKSHEET-016, SCANNER-013, SCANNER-014, SCANNER-015, SCANNER-016, SCANNER-025, SCANNER-028
it("recovers logical orientation and colors after rotating and rescaling a shared worksheet", async () => {
  const l = layout("A4", 2),
    colors = ["#12aa34", "#2345cc", "#ee4422", "#ffffff"];
  let svg = worksheetSvg("A4", 2);
  const cells = colors
    .map(
      (c, i) =>
        `<rect x="${l.x + ((i % 2) * l.side) / 2 + 0.5}" y="${l.y + (Math.floor(i / 2) * l.side) / 2 + 0.5}" width="${l.side / 2 - 1}" height="${l.side / 2 - 1}" fill="${c}"/>`,
    )
    .join("");
  svg = svg.replace("<!-- drawing -->", cells);
  for (const angle of [0, 90, 180, 270]) {
    const image = await raster(svg, angle, angle === 180 ? 800 : 1000),
      found = detectGrid(image);
    expect(found.confirmed).toBe(true);
    expect(found.n).toBe(2);
    expect(found.markerCount).toBe(4);
    const pixels = sampleGrid(image, found.corners!, 2);
    expect([...pixels]).toEqual([
      18, 170, 52, 35, 69, 204, 238, 68, 34, 255, 255, 255,
    ]);
  }
}, 20000);
// @spec SCANNER-015, SCANNER-017, SCANNER-021
it("requires manual alignment when a corner marker is missing", async () => {
  const svg = worksheetSvg("LETTER", 32).replace(
    /<g data-marker="0">[\s\S]*?<\/g>/,
    "",
  );
  const found = detectGrid(await raster(svg));
  expect(found.corners).toBeNull();
  expect(found.confirmed).toBe(false);
});
