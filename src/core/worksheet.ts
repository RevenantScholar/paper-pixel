import aruco from "js-aruco2";
const { AR } = aruco;
import QRCode from "qrcode";
export type Point = { x: number; y: number };
export type Paper = "A4" | "LETTER";
export const DEFAULT_GRID = 32;
// @spec WORKSHEET-001, WORKSHEET-002, WORKSHEET-003, WORKSHEET-004
export function validateGrid(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (String(value).trim() === "" || !Number.isInteger(n) || n < 2 || n > 64)
    throw new Error("Choose a whole number from 2 to 64.");
  return n;
}
export const recognitionMarkers = [
  { x: 0, y: -0.075 },
  { x: 0.94, y: -0.075 },
  { x: 0.94, y: 1.015 },
  { x: 0, y: 1.015 },
].map((p, id) => ({
  id,
  corners: [
    p,
    { x: p.x + 0.06, y: p.y },
    { x: p.x + 0.06, y: p.y + 0.06 },
    { x: p.x, y: p.y + 0.06 },
  ],
}));
// @spec WORKSHEET-005, WORKSHEET-006, WORKSHEET-008, WORKSHEET-010, WORKSHEET-011, WORKSHEET-016
export function layout(paper: Paper, n: number) {
  validateGrid(n);
  if (paper !== "A4" && paper !== "LETTER")
    throw new Error("Choose A4 or US Letter.");
  const [width, height] = paper === "A4" ? [210, 297] : [215.9, 279.4];
  const side = Math.min(width - 16, height - 52),
    x = (width - side) / 2,
    y = (height - side) / 2;
  if (x - 0.01 * side < 0 || y - 0.115 * side < 0 || y + 1.085 * side > height)
    throw new Error("Worksheet does not fit the page.");
  return { width, height, side, x, y, n, markers: recognitionMarkers };
}
// @spec WORKSHEET-013
export function metadata(n: number) {
  return `PXSCAN:1:${validateGrid(n)}`;
}
// @spec WORKSHEET-014, WORKSHEET-015
export function parseMetadata(text: string) {
  if (!text || text.length > 64 || !text.startsWith("PXSCAN:"))
    throw new Error("Worksheet metadata not recognized.");
  if (text.split(":")[1] !== "1")
    throw new Error(
      "Unsupported worksheet version. Place the grid corners manually.",
    );
  if (!/^PXSCAN:1:[1-9]\d*$/.test(text))
    throw new Error("Invalid worksheet dimensions.");
  return { version: 1 as const, gridSize: validateGrid(text.split(":")[2]) };
}
const dictionary = new AR.Dictionary("ARUCO_MIP_36h12");
// @spec WORKSHEET-007, WORKSHEET-009, WORKSHEET-012
export function worksheetSvg(paper: Paper, n: number) {
  const l = layout(paper, n),
    { x, y, side: s, width, height } = l;
  const marks = l.markers
    .map((m) => {
      const p = m.corners[0],
        mx = x + p.x * s,
        my = y + p.y * s;
      const inner = dictionary
        .generateSVG(m.id)
        .replace(/<svg[^>]*>/, "")
        .replace(/<\/svg>/, "");
      return `<g data-marker="${m.id}"><rect x="${mx - 0.01 * s}" y="${my - 0.01 * s}" width="${0.08 * s}" height="${0.08 * s}" fill="white"/><svg x="${mx}" y="${my}" width="${0.06 * s}" height="${0.06 * s}" viewBox="1 1 8 8">${inner}</svg></g>`;
    })
    .join("");
  const qr = QRCode.create(metadata(n), { errorCorrectionLevel: "M" }),
    q = qr.modules.size,
    unit = (0.1 * s) / (q + 8);
  let modules = "";
  for (let r = 0; r < q; r++)
    for (let c = 0; c < q; c++)
      if (qr.modules.get(r, c))
        modules += `<rect x="${x + 0.45 * s + (c + 4) * unit}" y="${y - 0.115 * s + (r + 4) * unit}" width="${unit}" height="${unit}"/>`;
  let lines = "";
  for (let i = 1; i < n; i++) {
    const t = (i * s) / n;
    lines += `<path d="M ${x + t} ${y} v ${s} M ${x} ${y + t} h ${s}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/><!-- drawing --><g stroke="#b6b6b6" stroke-width="0.15" fill="none">${lines}</g><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="none" stroke="#888" stroke-width="0.3"/>${marks}<g fill="black">${modules}</g><text x="${width / 2}" y="${y + s + 8}" text-anchor="middle" font-family="sans-serif" font-size="3.5" fill="#333">PAPER PIXEL · ${n} × ${n}</text><text x="${width / 2}" y="${y + s + 13}" text-anchor="middle" font-family="sans-serif" font-size="2.5" fill="#666">Color the cells. Keep the corner markers clear.</text></svg>`;
}
