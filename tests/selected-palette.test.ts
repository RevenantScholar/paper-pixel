import { afterEach, expect, it, vi } from "vitest";
import { mapPalette, PaletteCache } from "../src/core/artwork";
import {
  activeColors,
  decodePalette,
  loadLospecPalette,
  parseLospecSlug,
  readPalettes,
  savePalettes,
} from "../src/core/palettes";
afterEach(() => vi.unstubAllGlobals());
// @spec ARTWORK-034
it("accepts Lospec links and slugs while rejecting arbitrary URLs", () => {
  expect(parseLospecSlug(" PICO-8 ")).toBe("pico-8");
  expect(
    parseLospecSlug("https://lospec.com/palette-list/pico-8.json?x=1#colors"),
  ).toBe("pico-8");
  for (const input of [
    "Pico 8",
    "https://evil.test/palette-list/pico-8",
    "https://lospec.com.evil.test/palette-list/pico-8",
    "https://x@lospec.com/palette-list/pico-8",
    "https://lospec.com:444/palette-list/pico-8",
    "https://lospec.com/palette-list/tag/8bit",
    "../pico-8",
  ])
    expect(() => parseLospecSlug(input)).toThrow();
});
// @spec ARTWORK-034, ARTWORK-037
it("validates imported colors and the enabled edited set", () => {
  const palette = decodePalette(
    { name: "Test", author: "Artist", colors: ["FF0000", "00ff00", "0000ff"] },
    "test",
  );
  expect(palette.original).toEqual(["ff0000", "00ff00", "0000ff"]);
  expect(
    activeColors([
      { hex: "#FF0000", enabled: true },
      { hex: "ff0000", enabled: true },
      { hex: "00ff00", enabled: true },
      { hex: "0000ff", enabled: false },
    ]),
  ).toEqual([
    [255, 0, 0],
    [0, 255, 0],
  ]);
  expect(() => activeColors([{ hex: "ffffff", enabled: true }])).toThrow();
  expect(() =>
    activeColors([
      { hex: "ffffff", enabled: true },
      { hex: "bad!", enabled: false },
    ]),
  ).toThrow();
  for (const colors of [
    ["oops", "ffffff"],
    ["ffffff", "ffffff"],
    Array(257).fill("ffffff"),
  ])
    expect(() => decodePalette({ name: "x", colors }, "x")).toThrow();
});
// @spec ARTWORK-034, ARTWORK-035
it("fetches only canonical palette metadata and rejects invalid/oversized responses", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ name: "Pico", colors: ["ffffff", "000000"] }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(
    (await loadLospecPalette("pico-8", new AbortController().signal)).name,
  ).toBe("Pico");
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://lospec.com/palette-list/pico-8.json",
  );
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  fetcher.mockResolvedValueOnce(new Response("no", { status: 404 }));
  await expect(
    loadLospecPalette("missing", new AbortController().signal),
  ).rejects.toThrow(/not found/i);
  fetcher.mockResolvedValueOnce(new Response(" ".repeat(65537)));
  await expect(
    loadLospecPalette("large", new AbortController().signal),
  ).rejects.toThrow(/large/i);
  fetcher.mockResolvedValueOnce(new Response("not json"));
  await expect(
    loadLospecPalette("invalid", new AbortController().signal),
  ).rejects.toThrow(/invalid/i);
});
// @spec ARTWORK-036
it("maps even single-color sources to exact selected colors without inferred bypass", () => {
  const input = new Uint8Array([254, 0, 0, 0, 254, 0, 0, 0, 254]);
  const palette: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  expect([...mapPalette(input, palette).pixels]).toEqual(palette.flat());
  expect([...mapPalette(new Uint8Array([254, 0, 0]), palette).pixels]).toEqual([
    255, 0, 0,
  ]);
  expect([...input]).toEqual([254, 0, 0, 0, 254, 0, 0, 0, 254]);
  const cache = new PaletteCache();
  cache.reset(1);
  cache.set(
    1,
    "selected:v1:ff0000,00ff00",
    mapPalette(input, palette.slice(0, 2)),
  );
  expect(cache.get(1, "selected:v1:000000,ffffff")).toBeUndefined();
  expect(cache.get(1, 2)).toBeUndefined();
});
// @spec ARTWORK-038
it("remembers bounded palette definitions and valid edits, tolerating storage failures", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const palettes = Array.from({ length: 20 }, (_, i) =>
    decodePalette(
      { name: `Test ${i}`, colors: ["ffffff", "000000"] },
      `test-${i}`,
    ),
  );
  palettes[0].colors[0].hex = "ff0000";
  savePalettes(palettes, storage);
  const restored = readPalettes(storage);
  expect(restored).toHaveLength(16);
  expect(restored[0].colors[0].hex).toBe("ff0000");
  expect(restored[0].original[0]).toBe("ffffff");
  expect(JSON.stringify(restored)).not.toContain("pixels");
  expect(readPalettes({ getItem: () => "broken" })).toEqual([]);
  expect(
    readPalettes({
      getItem: () => {
        throw Error("blocked");
      },
    }),
  ).toEqual([]);
  expect(() =>
    savePalettes(palettes, {
      setItem: () => {
        throw Error("quota");
      },
    }),
  ).not.toThrow();
});

// @spec ARTWORK-039
it("ships six validated source-attributed palettes for each preset size", async () => {
  const { default: bundled } = await import("../src/data/palettes.json");
  expect(bundled).toHaveLength(24);
  expect(new Set(bundled.map((p) => p.slug)).size).toBe(24);
  for (const size of [2, 4, 16, 256]) {
    const group = bundled.filter((p) => p.size === size);
    expect(group).toHaveLength(6);
    for (const p of group) {
      expect(p.colors).toHaveLength(size);
      expect(decodePalette(p, p.slug).colors).toHaveLength(size);
      expect(p.attribution).toMatch(/Created by|Submitted by/);
    }
  }
});
