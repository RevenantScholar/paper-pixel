import { describe, it, expect } from "vitest";
import {
  layout,
  metadata,
  parseMetadata,
  validateGrid,
  worksheetSvg,
  DEFAULT_GRID,
} from "../src/core/worksheet";
import {
  fitHomography,
  project,
  sampleGrid,
  gridQuality,
  validCorners,
} from "../src/core/geometry";
import {
  quantize,
  PaletteCache,
  scaledPixels,
  exportSize,
} from "../src/core/artwork";
import { inspectImage } from "../src/core/image";
import { ScanSession } from "../src/core/session";

describe("worksheet contract", () => {
  // @spec WORKSHEET-001, WORKSHEET-002, WORKSHEET-003, WORKSHEET-004
  it("defaults to 32 and validates the complete integer range", () => {
    expect(DEFAULT_GRID).toBe(32);
    for (let n = 2; n <= 64; n++) expect(validateGrid(String(n))).toBe(n);
    for (const n of ["", "abc", "1", "65", "2.5", "Infinity"])
      expect(() => validateGrid(n)).toThrow();
  });
  // @spec WORKSHEET-005, WORKSHEET-006, WORKSHEET-008, WORKSHEET-010, WORKSHEET-011, WORKSHEET-016
  it("maximizes both page layouts with paper-independent recognition geometry", () => {
    for (const paper of ["A4", "LETTER"] as const) {
      const a = layout(paper, 2),
        b = layout(paper, 64);
      expect(a.side).toBeCloseTo(paper === "A4" ? 194 : 199.9);
      expect(a.side).toBe(b.side);
      expect(a.markers).toEqual(b.markers);
      for (const m of a.markers)
        for (const p of m.corners) {
          expect(a.x + p.x * a.side).toBeGreaterThan(0);
          expect(a.y + p.y * a.side).toBeGreaterThan(0);
          expect(a.y + p.y * a.side).toBeLessThan(a.height);
        }
    }
    expect(layout("A4", 32).markers).toEqual(layout("LETTER", 32).markers);
  });
  // @spec WORKSHEET-013, WORKSHEET-014, WORKSHEET-015
  it("round trips minimal metadata and rejects malformed/unknown formats", () => {
    expect(metadata(32)).toBe("PXSCAN:1:32");
    expect(parseMetadata(metadata(32))).toEqual({ version: 1, gridSize: 32 });
    for (const value of [
      "PXSCAN:1:032",
      "PXSCAN:1:32:LETTER",
      "PXSCAN:1:65",
      "PXSCAN:2:32",
      "other",
      "x".repeat(65),
    ])
      expect(() => parseMetadata(value)).toThrow();
  });
  // @spec WORKSHEET-007, WORKSHEET-009
  it("prints vector grid lines and four distinct machine-readable markers", () => {
    const svg = worksheetSvg("A4", 32);
    expect(svg).toContain("210mm");
    expect(svg).toContain("0.15");
    expect((svg.match(/data-marker=/g) || []).length).toBe(4);
    expect(svg).toContain("32 × 32");
  });
});

describe("scan geometry", () => {
  const square = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ];
  // @spec SCANNER-014, SCANNER-015, SCANNER-021, SCANNER-022
  it("recovers a projective transform and rejects degenerate geometry", () => {
    const from = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const to = [
      { x: 10, y: 20 },
      { x: 200, y: 30 },
      { x: 170, y: 180 },
      { x: 30, y: 140 },
    ];
    const h = fitHomography(from, to);
    from.forEach((p, i) => {
      expect(project(h, p).x).toBeCloseTo(to[i].x, 6);
      expect(project(h, p).y).toBeCloseTo(to[i].y, 6);
    });
    expect(validCorners(to, 220, 200)).toBe(true);
    expect(validCorners([to[0], to[2], to[1], to[3]], 220, 200)).toBe(false);
    expect(() =>
      fitHomography(
        from,
        from.map(() => ({ x: 0, y: 0 })),
      ),
    ).toThrow();
  });
  // @spec SCANNER-023, SCANNER-024
  it("measures thin skewed cells and exact warning thresholds", () => {
    expect(gridQuality(square, 10).minimum).toBeCloseTo(8);
    expect(gridQuality(square, 20).level).toBe("warning");
    expect(gridQuality(square, 21).level).toBe("blocked");
    expect(
      gridQuality(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 160, y: 2 },
          { x: 80, y: 2 },
        ],
        2,
      ).level,
    ).toBe("blocked");
  });
  // @spec SCANNER-025, SCANNER-026, SCANNER-027
  it("samples interiors, ignores black grid borders, and retains blank cells", () => {
    const w = 100,
      h = 100,
      data = new Uint8ClampedArray(w * h * 4);
    const colors = [
      [10, 180, 30],
      [20, 40, 210],
      [255, 255, 255],
      [180, 20, 30],
    ];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = colors[(y >= 50 ? 2 : 0) + (x >= 50 ? 1 : 0)];
        const border =
          x < 12 ||
          x > 88 ||
          y < 12 ||
          y > 88 ||
          Math.abs(x - 50) < 2 ||
          Math.abs(y - 50) < 2;
        data.set([...(border ? [0, 0, 0] : c), 255], (y * w + x) * 4);
      }
    expect([...sampleGrid({ data, width: w, height: h }, square, 2)]).toEqual(
      colors.flat(),
    );
  });
});

describe("inferred palettes and exact exports", () => {
  const colors = new Uint8Array([
    10, 180, 30, 20, 40, 210, 10, 180, 30, 20, 40, 210,
  ]);
  // @spec ARTWORK-005, ARTWORK-006, ARTWORK-012, ARTWORK-018
  it("preserves green and blue, and exact colors at sufficient capacity", () => {
    expect([...quantize(colors, 2).pixels]).toEqual([...colors]);
    expect([...quantize(colors, null).pixels]).toEqual([...colors]);
    expect(
      quantize(new Uint8Array([12, 34, 56, 12, 34, 56]), 2).colors.length,
    ).toBe(1);
  });
  // @spec ARTWORK-007, ARTWORK-008, ARTWORK-009, ARTWORK-010, ARTWORK-011, ARTWORK-013
  it("deterministically consolidates variations into representative green and blue", () => {
    const input = new Uint8Array([
      0, 170, 20, 8, 180, 30, 0, 20, 180, 10, 30, 190,
    ]);
    const a = quantize(input, 2),
      b = quantize(input, 2);
    expect(a).toEqual(b);
    expect(a.colors.length).toBe(2);
    expect(a.colors.some((c) => c[1] > 150 && c[2] < 60)).toBe(true);
    expect(a.colors.some((c) => c[2] > 150 && c[1] < 60)).toBe(true);
    expect(a.counts.reduce((a, b) => a + b, 0)).toBe(4);
    const paper = quantize(
      new Uint8Array([255, 255, 255, 255, 255, 255, 0, 100, 0, 0, 0, 100]),
      3,
    );
    expect(paper.colors).toContainEqual([255, 255, 255]);
  });
  // @spec ARTWORK-026, ARTWORK-027, ARTWORK-029, ARTWORK-030, ARTWORK-031, ARTWORK-032
  it("caches logical results, evicts least recently used, and resets for new sources", () => {
    const cache = new PaletteCache(2);
    cache.reset(1);
    const value = quantize(colors, 2);
    cache.set(1, 2, value);
    cache.set(1, 3, value);
    expect(cache.get(1, 2)).toBe(value);
    cache.set(1, 4, value);
    expect(cache.get(1, 3)).toBeUndefined();
    expect(cache.get(1, 2)).toBe(value);
    cache.reset(2);
    expect(cache.get(1, 2)).toBeUndefined();
    cache.set(1, 2, value);
    expect(cache.get(2, 2)).toBeUndefined();
  });
  // @spec ARTWORK-003, ARTWORK-019, ARTWORK-020, ARTWORK-021
  it("replicates pixels at integer scales and rejects resource overflow", () => {
    expect(exportSize(32, "1")).toBe(32);
    expect(exportSize(32, "3")).toBe(96);
    expect(exportSize(32, "128")).toBe(4096);
    for (const s of ["", "0", "-1", "1.5", "129", "Infinity"])
      expect(() => exportSize(32, s)).toThrow();
    const rgba = scaledPixels(colors, 2, 3);
    expect(rgba.length).toBe(6 * 6 * 4);
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++)
        expect([...rgba.slice((y * 6 + x) * 4, (y * 6 + x) * 4 + 4)]).toEqual([
          ...colors.slice(
            (Math.floor(y / 3) * 2 + Math.floor(x / 3)) * 3,
            (Math.floor(y / 3) * 2 + Math.floor(x / 3)) * 3 + 3,
          ),
          255,
        ]);
  });
});

describe("image boundaries and lifecycle", () => {
  // @spec SCANNER-006, SCANNER-007
  it("checks image headers before allocating decoded images", () => {
    const png = new Uint8Array(33);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    png.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
    const view = new DataView(png.buffer);
    view.setUint32(16, 4000);
    view.setUint32(20, 3000);
    expect(inspectImage(png, 10000)).toMatchObject({
      width: 4000,
      height: 3000,
      type: "image/png",
    });
    view.setUint32(16, 20000);
    expect(() => inspectImage(png, 10000)).toThrow();
    expect(() => inspectImage(new Uint8Array(10), 100)).toThrow();
    expect(() => inspectImage(png, 21 * 1024 * 1024)).toThrow();
  });
  // @spec WORKSHEET-017, SCANNER-005, SCANNER-009, SCANNER-010, SCANNER-019, SCANNER-027, SCANNER-029, SCANNER-030, ARTWORK-015
  it("preserves committed work on failed retake but invalidates geometry and late results", () => {
    const session = new ScanSession();
    session.commitPhoto();
    const revision = session.drawingRevision;
    session.acknowledge();
    expect(session.acknowledged).toBe(true);
    const request = session.beginRequest();
    session.beginReplacement();
    expect(session.drawingRevision).toBe(revision);
    expect(session.isCurrent(request)).toBe(false);
    session.changeGeometry();
    expect(session.drawingRevision).toBeGreaterThan(revision);
    expect(session.acknowledged).toBe(false);
    const next = session.drawingRevision;
    session.commitPhoto();
    expect(session.drawingRevision).toBeGreaterThan(next);
  });
});
