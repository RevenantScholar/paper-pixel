import { detectGrid } from "./core/detection";
import { sampleGrid } from "./core/geometry";
import { quantize, mapPalette, recolorGroups } from "./core/artwork";
// @spec SCANNER-009, ARTWORK-016, ARTWORK-036, ARTWORK-042
self.onmessage = (event: MessageEvent) => {
  const { id, kind, ...args } = event.data;
  try {
    const result =
      kind === "detect"
        ? detectGrid(args.image)
        : kind === "sample"
          ? sampleGrid(args.image, args.corners, args.n)
          : kind === "recolor"
            ? recolorGroups(args.groups, args.targets)
            : kind === "map"
              ? mapPalette(args.pixels, args.colors)
              : quantize(args.pixels, args.k);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
