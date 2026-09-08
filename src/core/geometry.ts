import type { Point } from "./worksheet";
export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type Matrix = number[];
export const unitCorners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export function project(h: Matrix, p: Point): Point {
  const d = h[6] * p.x + h[7] * p.y + 1;
  if (Math.abs(d) < 1e-10) throw new Error("The grid angle is too extreme.");
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / d,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / d,
  };
}
function normalize(ps: Point[]) {
  const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length,
    cy = ps.reduce((a, p) => a + p.y, 0) / ps.length;
  const scale =
    Math.sqrt(2) /
    (ps.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / ps.length);
  if (!Number.isFinite(scale))
    throw new Error("The grid corners must be distinct.");
  return {
    cx,
    cy,
    scale,
    points: ps.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale })),
  };
}
function multiply(a: number[], b: number[]) {
  return Array.from({ length: 9 }, (_, i) => {
    const r = Math.floor(i / 3),
      c = i % 3;
    return a[r * 3] * b[c] + a[r * 3 + 1] * b[c + 3] + a[r * 3 + 2] * b[c + 6];
  });
}
// @spec SCANNER-014, SCANNER-015, SCANNER-022
export function fitHomography(from: Point[], to: Point[]): Matrix {
  if (from.length < 4 || from.length !== to.length)
    throw new Error("Four grid corners are needed.");
  const f = normalize(from),
    t = normalize(to),
    a: number[][] = [],
    b: number[] = [];
  f.points.forEach((p, i) => {
    const q = t.points[i];
    a.push(
      [p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y],
      [0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y],
    );
    b.push(q.x, q.y);
  });
  const m = Array.from({ length: 8 }, (_, i) => [
    ...Array.from({ length: 8 }, (_, j) =>
      a.reduce((s, r) => s + r[i] * r[j], 0),
    ),
    a.reduce((s, r, k) => s + r[i] * b[k], 0),
  ]);
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++)
      if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    if (Math.abs(m[pivot][c]) < 1e-10)
      throw new Error("The grid is too narrow or its corners overlap.");
    [m[c], m[pivot]] = [m[pivot], m[c]];
    const d = m[c][c];
    for (let j = c; j <= 8; j++) m[c][j] /= d;
    for (let r = 0; r < 8; r++)
      if (r !== c) {
        const v = m[r][c];
        for (let j = c; j <= 8; j++) m[r][j] -= v * m[c][j];
      }
  }
  const h = multiply(
    multiply(
      [1 / t.scale, 0, t.cx, 0, 1 / t.scale, t.cy, 0, 0, 1],
      [...m.map((r) => r[8]), 1],
    ),
    [f.scale, 0, -f.cx * f.scale, 0, f.scale, -f.cy * f.scale, 0, 0, 1],
  );
  if (Math.abs(h[8]) < 1e-10 || h.some((v) => !Number.isFinite(v)))
    throw new Error("Could not align this grid.");
  return h.slice(0, 8).map((v) => v / h[8]);
}
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
// @spec SCANNER-021
export function validCorners(c: Point[], width: number, height: number) {
  return (
    c.length === 4 &&
    c.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < width &&
        p.y < height,
    ) &&
    c.every((p, i) => cross(p, c[(i + 1) % 4], c[(i + 2) % 4]) > 1e-5)
  );
}
// @spec SCANNER-023, SCANNER-024
export function gridQuality(corners: Point[], n: number) {
  const h = fitHomography(unitCorners, corners);
  let minimum = Infinity;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const p = unitCorners.map((p) =>
        project(h, { x: (x + p.x) / n, y: (y + p.y) / n }),
      );
      for (let i = 0; i < 4; i++) {
        const a = p[i],
          b = p[(i + 1) % 4],
          len = Math.hypot(b.x - a.x, b.y - a.y);
        let thickness = 0;
        for (const v of p)
          thickness = Math.max(
            thickness,
            Math.abs((b.x - a.x) * (v.y - a.y) - (b.y - a.y) * (v.x - a.x)) /
              len,
          );
        minimum = Math.min(minimum, thickness);
      }
    }
  return {
    minimum,
    level:
      minimum < 4 - 1e-8 ? "blocked" : minimum < 8 - 1e-8 ? "warning" : "good",
  } as const;
}
// @spec SCANNER-025, SCANNER-026, SCANNER-027
export function sampleGrid(image: Raster, corners: Point[], n: number) {
  if (!validCorners(corners, image.width, image.height))
    throw new Error("Place the corners clockwise inside the photo.");
  if (gridQuality(corners, n).level === "blocked")
    throw new Error("Cells are too small. Take a closer photo.");
  const h = fitHomography(unitCorners, corners),
    out = new Uint8Array(n * n * 3);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const channels: number[][] = [[], [], []];
      for (let sy = 0; sy < 5; sy++)
        for (let sx = 0; sx < 5; sx++) {
          const p = project(h, {
            x: (x + 0.25 + sx * 0.125) / n,
            y: (y + 0.25 + sy * 0.125) / n,
          });
          if (
            p.x < 0 ||
            p.y < 0 ||
            p.x >= image.width - 1 ||
            p.y >= image.height - 1
          )
            throw new Error("The grid extends beyond the photo.");
          const ix = Math.floor(p.x),
            iy = Math.floor(p.y),
            fx = p.x - ix,
            fy = p.y - iy;
          for (let c = 0; c < 3; c++) {
            const at = (xx: number, yy: number) =>
              image.data[(yy * image.width + xx) * 4 + c];
            channels[c].push(
              at(ix, iy) * (1 - fx) * (1 - fy) +
                at(ix + 1, iy) * fx * (1 - fy) +
                at(ix, iy + 1) * (1 - fx) * fy +
                at(ix + 1, iy + 1) * fx * fy,
            );
          }
        }
      for (let c = 0; c < 3; c++)
        out[(y * n + x) * 3 + c] = Math.round(
          channels[c].sort((a, b) => a - b)[12],
        );
    }
  return out;
}
