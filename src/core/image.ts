import type { Raster } from "./geometry";
// @spec SCANNER-006, SCANNER-007
export function inspectImage(bytes: Uint8Array, fileSize: number) {
  if (fileSize > 20 * 1024 * 1024)
    throw new Error("Choose an image smaller than 20 MB.");
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0,
    type = "";
  const text = (o: number, n: number) =>
    String.fromCharCode(...bytes.slice(o, o + n));
  try {
    if (bytes[0] === 137 && text(1, 3) === "PNG" && text(12, 4) === "IHDR") {
      width = d.getUint32(16);
      height = d.getUint32(20);
      type = "image/png";
    } else if (bytes[0] === 255 && bytes[1] === 216) {
      type = "image/jpeg";
      let p = 2;
      while (p + 4 <= bytes.length) {
        if (bytes[p] !== 255) throw 0;
        while (bytes[p] === 255) p++;
        const marker = bytes[p++];
        if (marker === 0xda || marker === 0xd9) break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const len = d.getUint16(p);
        if (len < 2 || p + len > bytes.length) throw 0;
        if (
          [
            0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
            0xce, 0xcf,
          ].includes(marker)
        ) {
          height = d.getUint16(p + 3);
          width = d.getUint16(p + 5);
          break;
        }
        p += len;
      }
    } else if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
      type = "image/webp";
      const kind = text(12, 4);
      if (kind === "VP8X") {
        width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
        height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
        if (bytes[20] & 2) throw new Error("Choose a still image.");
      } else if (kind === "VP8 ") {
        width = d.getUint16(26, true) & 0x3fff;
        height = d.getUint16(28, true) & 0x3fff;
      } else if (kind === "VP8L") {
        const b = d.getUint32(21, true);
        width = (b & 0x3fff) + 1;
        height = ((b >>> 14) & 0x3fff) + 1;
      }
    }
  } catch {
    throw new Error(
      "This image has an unreadable header. Choose a JPEG, PNG, or still WebP.",
    );
  }
  if (
    !type ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  )
    throw new Error("Choose a valid JPEG, PNG, or still WebP photo.");
  if (width > 12000 || height > 12000 || width * height > 48000000)
    throw new Error(
      "This image is too large. Use a photo up to 48 megapixels and 12,000 pixels per side.",
    );
  return { width, height, type };
}
export type Photo = { raster: Raster; url: string };
// @spec SCANNER-007, SCANNER-008, SCANNER-012
export async function decodePhoto(file: File): Promise<Photo> {
  const bytes = new Uint8Array(await file.arrayBuffer()),
    header = inspectImage(bytes, file.size);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    if (!(
      (bitmap.width === header.width && bitmap.height === header.height) ||
      (bitmap.width === header.height && bitmap.height === header.width)
    ))
      throw new Error("Image dimensions do not match its header.");
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
      colorSpace: "srgb",
    })!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height),
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Could not prepare the photo.")),
          "image/jpeg",
          0.94,
        ),
      );
    return {
      raster: { width: image.width, height: image.height, data: image.data },
      url: URL.createObjectURL(blob),
    };
  } finally {
    bitmap.close();
  }
}
