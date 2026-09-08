import { detectGrid } from "./core/detection";
import { sampleGrid } from "./core/geometry";
import { quantize } from "./core/artwork";
// @spec SCANNER-009, ARTWORK-016
self.onmessage = (event: MessageEvent) => {
  const { id, kind, ...args } = event.data;
  try {
    const result =
      kind === "detect"
        ? detectGrid(args.image)
        : kind === "sample"
          ? sampleGrid(args.image, args.corners, args.n)
          : quantize(args.pixels, args.k);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
