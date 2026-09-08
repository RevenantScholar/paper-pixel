export type RGB = [number, number, number];
export type PaletteResult = {
  pixels: Uint8Array;
  colors: RGB[];
  counts: number[];
};
const linear = (v: number) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export function oklab(c: RGB): RGB {
  const [r, g, b] = c.map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function rgb(c: RGB): RGB {
  const [L, a, b] = c,
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) =>
    Math.round(
      255 *
        Math.max(
          0,
          Math.min(
            1,
            v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055,
          ),
        ),
    ),
  ) as RGB;
}
// Preserve pigment hue differences when paper brightness dominates the drawing.
// Use the same metric for seeding, refinement, and final pixel assignment.
const axisWeights = [1, 8, 8] as const;
const distance = (a: RGB, b: RGB) =>
  axisWeights[0] * (a[0] - b[0]) ** 2 +
  axisWeights[1] * (a[1] - b[1]) ** 2 +
  axisWeights[2] * (a[2] - b[2]) ** 2;
const key = (c: RGB) => c[0] * 65536 + c[1] * 256 + c[2];
function pack(pixels: Uint8Array): PaletteResult {
  const map = new Map<number, number>(),
    colors: RGB[] = [],
    counts: number[] = [];
  for (let i = 0; i < pixels.length; i += 3) {
    const c = [pixels[i], pixels[i + 1], pixels[i + 2]] as RGB,
      k = key(c);
    let j = map.get(k);
    if (j === undefined) {
      j = colors.length;
      map.set(k, j);
      colors.push(c);
      counts.push(0);
    }
    counts[j]++;
  }
  return { pixels, colors, counts };
}
type Entry = { c: RGB; lab: RGB; weight: number; k: number };
const mean = (items: Entry[]): RGB => {
  const w = items.reduce((s, e) => s + e.weight, 0);
  return [0, 1, 2].map(
    (i) => items.reduce((s, e) => s + e.lab[i] * e.weight, 0) / w,
  ) as RGB;
};
function cluster(items: Entry[]) {
  const center = mean(items),
    variance = [0, 1, 2].map(
      (i) =>
        axisWeights[i] *
        items.reduce((s, e) => s + (e.lab[i] - center[i]) ** 2 * e.weight, 0),
    );
  return {
    items,
    center,
    variance,
    error: variance.reduce((a, b) => a + b, 0),
    k: Math.min(...items.map((e) => e.k)),
  };
}
// @spec ARTWORK-005, ARTWORK-006, ARTWORK-007, ARTWORK-008, ARTWORK-009, ARTWORK-010, ARTWORK-011, ARTWORK-012, ARTWORK-013, ARTWORK-018
export function quantize(input: Uint8Array, k: number | null): PaletteResult {
  if (input.length % 3) throw new Error("Invalid RGB drawing.");
  if (k !== null && (!Number.isInteger(k) || k < 2 || k > 16777216))
    throw new Error("Choose a palette size from 2 to 16,777,216.");
  const original = pack(input.slice());
  if (k === null || original.colors.length <= k) return original;
  const entries = original.colors.map((c, i) => ({
    c,
    lab: oklab(c),
    weight: original.counts[i],
    k: key(c),
  }));
  let clusters = [cluster(entries)];
  while (clusters.length < k) {
    let best = -1;
    for (let i = 0; i < clusters.length; i++)
      if (
        clusters[i].items.length > 1 &&
        (best < 0 ||
          clusters[i].error > clusters[best].error ||
          (clusters[i].error === clusters[best].error &&
            clusters[i].k < clusters[best].k))
      )
        best = i;
    if (best < 0) break;
    const c = clusters[best];
    let axis = 0;
    for (let i = 1; i < 3; i++) if (c.variance[i] > c.variance[axis]) axis = i;
    const sorted = [...c.items].sort(
        (a, b) => a.lab[axis] - b.lab[axis] || a.k - b.k,
      ),
      half = sorted.reduce((s, e) => s + e.weight, 0) / 2;
    let sum = 0,
      cut = sorted.length - 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      sum += sorted[i].weight;
      if (sum >= half) {
        cut = i + 1;
        break;
      }
    }
    clusters.splice(
      best,
      1,
      cluster(sorted.slice(0, cut)),
      cluster(sorted.slice(cut)),
    );
  }
  let centers = clusters.map((c) => c.center),
    bestCenters = centers,
    bestError = Infinity,
    previous: number[] = [];
  for (let iteration = 0; iteration <= 12; iteration++) {
    const groups: Entry[][] = centers.map(() => []),
      assign: number[] = [];
    let error = 0;
    for (const e of entries) {
      let j = 0;
      for (let i = 1; i < centers.length; i++)
        if (distance(e.lab, centers[i]) < distance(e.lab, centers[j])) j = i;
      groups[j].push(e);
      assign.push(j);
      error += e.weight * distance(e.lab, centers[j]);
    }
    if (error < bestError) {
      bestError = error;
      bestCenters = centers;
    }
    if (assign.every((v, i) => v === previous[i]) || iteration === 12) break;
    previous = assign;
    centers = groups.map((g, i) => (g.length ? mean(g) : centers[i]));
  }
  const palette = [
      ...new Map(
        bestCenters.map((c) => {
          const v = rgb(c);
          return [key(v), v];
        }),
      ).values(),
    ],
    labs = palette.map(oklab),
    lookup = new Map<number, RGB>();
  for (const e of entries) {
    let j = 0;
    for (let i = 1; i < labs.length; i++)
      if (distance(e.lab, labs[i]) < distance(e.lab, labs[j])) j = i;
    lookup.set(e.k, palette[j]);
  }
  const pixels = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 3)
    pixels.set(
      lookup.get(input[i] * 65536 + input[i + 1] * 256 + input[i + 2])!,
      i,
    );
  return pack(pixels);
}
// @spec ARTWORK-041
export function suggestGroupTargets(source: RGB[], targets: RGB[]): number[] {
  if (!targets.length) throw new Error("Choose a target palette.");
  const from = source.map(oklab),
    to = targets.map(oklab);
  const chroma = (colors: RGB[]) =>
    Math.max(0, ...colors.map((c) => Math.hypot(c[1], c[2])));
  const scale = Math.max(
    0.25,
    Math.min(4, chroma(to) / Math.max(0.02, chroma(from))),
  );
  return from.map((lab, i) => {
    const exact = targets.findIndex((c) => key(c) === key(source[i]));
    if (exact >= 0) return exact;
    const adjusted: RGB = [lab[0], lab[1] * scale, lab[2] * scale];
    let best = 0;
    for (let j = 1; j < to.length; j++)
      if (distance(adjusted, to[j]) < distance(adjusted, to[best])) best = j;
    return best;
  });
}
// @spec ARTWORK-042
export function recolorGroups(
  groups: PaletteResult,
  targets: RGB[],
): PaletteResult {
  if (
    targets.length !== groups.colors.length ||
    targets.some(
      (c) =>
        c.length !== 3 ||
        c.some((v) => !Number.isInteger(v) || v < 0 || v > 255),
    )
  )
    throw new Error("Choose a valid target for every drawing color.");
  const lookup = new Map(groups.colors.map((c, i) => [key(c), targets[i]]));
  const pixels = new Uint8Array(groups.pixels.length);
  for (let i = 0; i < pixels.length; i += 3) {
    const color = lookup.get(
      key([groups.pixels[i], groups.pixels[i + 1], groups.pixels[i + 2]]),
    );
    if (!color) throw new Error("Drawing groups do not match the source.");
    pixels.set(color, i);
  }
  return pack(pixels);
}
// @spec ARTWORK-036
export function mapPalette(input: Uint8Array, colors: RGB[]): PaletteResult {
  if (
    input.length % 3 ||
    colors.length < 2 ||
    colors.length > 256 ||
    colors.some(
      (c) =>
        c.length !== 3 ||
        c.some((v) => !Number.isInteger(v) || v < 0 || v > 255),
    )
  )
    throw new Error("Invalid selected palette.");
  const labs = colors.map(oklab),
    pixels = new Uint8Array(input.length);
  const lookup = new Map<number, RGB>();
  for (let i = 0; i < input.length; i += 3) {
    const source: RGB = [input[i], input[i + 1], input[i + 2]],
      id = key(source);
    let color = lookup.get(id);
    if (!color) {
      const lab = oklab(source);
      let best = 0;
      for (let j = 1; j < labs.length; j++)
        if (distance(lab, labs[j]) < distance(lab, labs[best])) best = j;
      color = colors[best];
      lookup.set(id, color);
    }
    pixels.set(color, i);
  }
  return pack(pixels);
}
// @spec ARTWORK-026, ARTWORK-027, ARTWORK-030, ARTWORK-031, ARTWORK-032
export class PaletteCache {
  private revision = -1;
  private values = new Map<number | string, PaletteResult>();
  constructor(private capacity = 32) {}
  reset(revision: number) {
    this.revision = revision;
    this.values.clear();
  }
  get(revision: number, k: number | string) {
    if (revision !== this.revision) return;
    const value = this.values.get(k);
    if (value) {
      this.values.delete(k);
      this.values.set(k, value);
    }
    return value;
  }
  set(revision: number, k: number | string, value: PaletteResult) {
    if (revision !== this.revision) return;
    this.values.delete(k);
    this.values.set(k, value);
    while (this.values.size > this.capacity)
      this.values.delete(this.values.keys().next().value!);
  }
}
// @spec ARTWORK-003, ARTWORK-019
export function exportSize(n: number, value: string | number) {
  const s = Number(value);
  if (
    String(value).trim() === "" ||
    !Number.isSafeInteger(s) ||
    s < 1 ||
    !Number.isInteger(n) ||
    n < 2 ||
    n > 64 ||
    s > Math.floor(4096 / n)
  )
    throw new Error(
      `Choose a whole-number scale from 1 to ${Math.floor(4096 / n)}.`,
    );
  return n * s;
}
// @spec ARTWORK-020, ARTWORK-021
export function scaledPixels(pixels: Uint8Array, n: number, s: number) {
  const size = exportSize(n, s);
  if (pixels.length !== n * n * 3)
    throw new Error("Drawing dimensions do not match.");
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const from = (Math.floor(y / s) * n + Math.floor(x / s)) * 3,
        to = (y * size + x) * 4;
      out[to] = pixels[from];
      out[to + 1] = pixels[from + 1];
      out[to + 2] = pixels[from + 2];
      out[to + 3] = 255;
    }
  return out;
}
