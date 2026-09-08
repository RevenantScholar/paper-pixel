import type { RGB } from "./artwork";
export type PaletteColor = { hex: string; enabled: boolean };
export type SelectedPalette = {
  slug: string;
  name: string;
  author: string;
  attribution?: string;
  original: string[];
  colors: PaletteColor[];
};
const HEX = /^[0-9a-f]{6}$/i;
const MAX_BYTES = 65536;
export const PALETTE_STORAGE_KEY = "paper-pixel:palettes:v1";
// @spec ARTWORK-034
export function parseLospecSlug(input: string) {
  let slug = input.trim().toLowerCase();
  if (slug.length > 512)
    throw new Error("Paste a Lospec palette URL or slug, such as pico-8.");
  if (/^https?:\/\//.test(slug)) {
    const url = new URL(slug);
    if (
      !["lospec.com", "www.lospec.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("Use a palette link from lospec.com.");
    const match = url.pathname.match(
      /^\/palette-list\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.json)?\/?$/,
    );
    if (!match)
      throw new Error("Paste a single palette link, not a search or tag page.");
    slug = match[1];
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 128)
    throw new Error(
      "Use the URL's palette slug, such as pico-8, rather than a display name.",
    );
  return slug;
}
// @spec ARTWORK-034, ARTWORK-037
export function activeColors(colors: PaletteColor[]): RGB[] {
  if (colors.length < 2 || colors.length > 256)
    throw new Error("Use 2 to 256 palette entries.");
  const active = new Set<string>();
  for (const color of colors) {
    if (
      !color ||
      typeof color.hex !== "string" ||
      typeof color.enabled !== "boolean"
    )
      throw new Error("Invalid palette color.");
    const hex = color.hex.replace(/^#/, "").toLowerCase();
    if (!HEX.test(hex))
      throw new Error("Enter six hex digits for every color.");
    if (color.enabled) active.add(hex);
  }
  if (active.size < 2) throw new Error("Enable at least two different colors.");
  return [...active].map(
    (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB,
  );
}
// @spec ARTWORK-034
export function decodePalette(value: unknown, slug: string): SelectedPalette {
  if (!value || typeof value !== "object")
    throw new Error("Lospec returned an invalid palette.");
  const v = value as Record<string, unknown>;
  if (
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.length > 200 ||
    (v.author !== undefined &&
      (typeof v.author !== "string" || v.author.length > 200)) ||
    !Array.isArray(v.colors) ||
    v.colors.length < 2 ||
    v.colors.length > 256 ||
    v.colors.some((c) => typeof c !== "string" || !HEX.test(c))
  )
    throw new Error("Invalid palette. Use a palette with 2 to 256 hex colors.");
  const original = (v.colors as string[]).map((c) => c.toLowerCase());
  const colors = original.map((hex) => ({ hex, enabled: true }));
  activeColors(colors);
  return {
    slug: parseLospecSlug(slug),
    name: v.name.trim(),
    author: (v.author as string | undefined) ?? "",
    original,
    colors,
  };
}
// @spec ARTWORK-034, ARTWORK-035
export async function loadLospecPalette(input: string, signal: AbortSignal) {
  const slug = parseLospecSlug(input);
  const response = await fetch(`https://lospec.com/palette-list/${slug}.json`, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (response.status === 404)
    throw new Error("Palette not found. Check the Lospec link or slug.");
  if (response.status === 429)
    throw new Error("Lospec is busy. Wait a moment and try again.");
  if (!response.ok)
    throw new Error("Could not load this palette. Please try again.");
  if (Number(response.headers.get("content-length")) > MAX_BYTES)
    throw new Error("Palette response is too large.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Lospec returned an empty palette.");
  let total = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Palette response is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Lospec returned invalid palette data.");
  }
  return decodePalette(value, slug);
}
function validStored(value: unknown): SelectedPalette {
  if (!value || typeof value !== "object")
    throw new Error("Invalid saved palette");
  const v = value as SelectedPalette;
  const original = decodePalette(
    { name: v.name, author: v.author, colors: v.original },
    v.slug,
  );
  if (!Array.isArray(v.colors)) throw new Error("Invalid edited palette");
  activeColors(v.colors);
  return {
    ...original,
    attribution: v.attribution === "Submitted by" ? "Submitted by" : undefined,
    colors: v.colors.map((c) => ({
      hex: c.hex.replace(/^#/, "").toLowerCase(),
      enabled: c.enabled,
    })),
  };
}
// @spec ARTWORK-038
export function readPalettes(
  storage?: Pick<Storage, "getItem">,
): SelectedPalette[] {
  try {
    const raw = (storage ?? localStorage).getItem(PALETTE_STORAGE_KEY);
    if (!raw || raw.length > 1024 * 1024) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: SelectedPalette[] = [];
    for (const item of parsed.slice(0, 16)) {
      try {
        const p = validStored(item);
        if (!result.some((v) => v.slug === p.slug)) result.push(p);
      } catch {
        /* Ignore one corrupt definition. */
      }
    }
    return result;
  } catch {
    return [];
  }
}
// @spec ARTWORK-038
export function savePalettes(
  palettes: SelectedPalette[],
  storage?: Pick<Storage, "setItem">,
) {
  try {
    (storage ?? localStorage).setItem(
      PALETTE_STORAGE_KEY,
      JSON.stringify(palettes.slice(0, 16).map(validStored)),
    );
  } catch {
    /* Palette editing still works in memory when storage is unavailable. */
  }
}
