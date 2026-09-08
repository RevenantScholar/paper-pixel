import aruco from "js-aruco2";
const { AR } = aruco;
import jsQR from "jsqr";
import { parseMetadata, recognitionMarkers, type Point } from "./worksheet";
import {
  fitHomography,
  project,
  validCorners,
  unitCorners,
  type Raster,
} from "./geometry";
export type Detection = {
  corners: Point[] | null;
  n: number | null;
  confirmed: boolean;
  message: string;
  markerCount: number;
};
function resized(image: Raster, max: number): Raster {
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const width = Math.round(image.width * scale),
    height = Math.round(image.height * scale),
    data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const from =
        (Math.floor((y * image.height) / height) * image.width +
          Math.floor((x * image.width) / width)) *
        4;
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  return { data, width, height };
}
// @spec SCANNER-013, SCANNER-014, SCANNER-015, SCANNER-016, SCANNER-017, SCANNER-018, SCANNER-028
export function detectGrid(image: Raster): Detection {
  const detector = new AR.Detector({
    dictionaryName: "ARUCO_MIP_36h12",
    maxHammingDistance: 3,
  });
  let detected: any[] = [];
  const small = resized(image, 1600);
  detected = detector.detect(small).filter((m: any) => m.id >= 0 && m.id <= 3);
  if (detected.length === 4 && new Set(detected.map((m) => m.id)).size === 4)
    detected = detected.map((m) => ({
      ...m,
      corners: m.corners.map((p: Point) => ({
        x: (p.x * image.width) / small.width,
        y: (p.y * image.height) / small.height,
      })),
    }));
  else
    detected = detector
      .detect(image)
      .filter((m: any) => m.id >= 0 && m.id <= 3);
  const qr = jsQR(image.data, image.width, image.height, {
    inversionAttempts: "dontInvert",
  });
  let n: number | null = null,
    unsupported = false,
    message = "Place the four grid corners, then confirm the grid size.";
  if (qr)
    try {
      n = parseMetadata(qr.data).gridSize;
    } catch (e) {
      message = (e as Error).message;
      unsupported =
        qr.data.startsWith("PXSCAN:") && qr.data.split(":")[1] !== "1";
    }
  if (
    unsupported ||
    detected.length !== 4 ||
    new Set(detected.map((m) => m.id)).size !== 4
  )
    return {
      corners: null,
      n,
      confirmed: false,
      message,
      markerCount: detected.length,
    };
  try {
    detected.sort((a, b) => a.id - b.id);
    const from = recognitionMarkers.flatMap((m) => m.corners),
      to = detected.flatMap((m) => m.corners) as Point[];
    const h = fitHomography(from, to),
      corners = unitCorners.map((p) => project(h, p));
    const error = Math.sqrt(
        from.reduce((s, p, i) => {
          const q = project(h, p);
          return s + (q.x - to[i].x) ** 2 + (q.y - to[i].y) ** 2;
        }, 0) / 16,
      ),
      short = Math.min(
        ...corners.map((p, i) =>
          Math.hypot(
            p.x - corners[(i + 1) % 4].x,
            p.y - corners[(i + 1) % 4].y,
          ),
        ),
      );
    if (
      !validCorners(corners, image.width, image.height) ||
      error > 0.01 * short
    )
      throw new Error(
        "Marker alignment is unclear. Adjust the drawing corners.",
      );
    let confirmed = false;
    if (qr && n) {
      const inverse = fitHomography(to, from),
        q = qr.location;
      confirmed = [
        q.topLeftCorner,
        q.topRightCorner,
        q.bottomRightCorner,
        q.bottomLeftCorner,
      ].every((p) => {
        const v = project(inverse, p);
        return v.x >= 0.435 && v.x <= 0.565 && v.y >= -0.13 && v.y <= 0;
      });
    }
    return {
      corners,
      n,
      confirmed,
      message: confirmed
        ? "All four markers found. Check the grid alignment below."
        : "Markers found. Confirm the grid size to continue.",
      markerCount: 4,
    };
  } catch (e) {
    return {
      corners: null,
      n,
      confirmed: false,
      message: (e as Error).message,
      markerCount: detected.length,
    };
  }
}
