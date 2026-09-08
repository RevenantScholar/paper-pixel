import { useEffect, useRef } from "react";
// @spec ARTWORK-002, ARTWORK-005
export function PixelCanvas({ pixels, n }: { pixels: Uint8Array; n: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d")!,
      data = ctx.createImageData(n, n);
    for (let i = 0; i < n * n; i++)
      data.data.set(
        [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2], 255],
        i * 4,
      );
    ctx.putImageData(data, 0, 0);
  }, [pixels, n]);
  return (
    <canvas
      ref={ref}
      className="pixel-canvas"
      role="img"
      aria-label={`${n} by ${n} pixel artwork preview`}
    />
  );
}
