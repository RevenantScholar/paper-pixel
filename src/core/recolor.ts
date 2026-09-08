import { suggestGroupTargets, type RGB } from "./artwork";
import type { PaletteColor } from "./palettes";
// @spec ARTWORK-043, ARTWORK-044
export function resolveGroupTargets(
  source: RGB[],
  palette: PaletteColor[],
  overrides: Record<string, number>,
) {
  const entries = palette.flatMap((c, index) =>
    c.enabled && /^#?[0-9a-f]{6}$/i.test(c.hex)
      ? [
          {
            index,
            rgb: [0, 2, 4].map((i) =>
              parseInt(c.hex.replace(/^#/, "").slice(i, i + 2), 16),
            ) as RGB,
          },
        ]
      : [],
  );
  if (!entries.length)
    return {
      indices: source.map(() => -1),
      targets: [] as RGB[],
      valid: false,
    };
  const suggestions = suggestGroupTargets(
    source,
    entries.map((e) => e.rgb),
  );
  const indices = source.map((c, i) => {
    const assigned = overrides[c.join(",")];
    return assigned === undefined
      ? entries[suggestions[i]].index
      : entries.some((e) => e.index === assigned)
        ? assigned
        : -1;
  });
  return {
    indices,
    targets: indices.map(
      (i) => entries.find((e) => e.index === i)?.rgb ?? ([0, 0, 0] as RGB),
    ),
    valid: indices.every((i) => i >= 0),
  };
}
