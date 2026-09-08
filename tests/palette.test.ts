import { expect, it } from "vitest";
import samples from "./fixtures/crayon-samples.json";
import { quantize } from "../src/core/artwork";

// @spec ARTWORK-007, ARTWORK-008, ARTWORK-010, ARTWORK-011, ARTWORK-013
it("keeps textured red and green distinct in a paper-heavy four-color drawing", () => {
  const input = new Uint8Array(samples);
  const result = quantize(input, 4);
  expect(result.colors).toHaveLength(4);
  // Pigment representatives must retain hue separation despite paper brightness variation.
  expect(result.colors.some(([r, g, b]) => r - g > 40 && r - b > 40)).toBe(
    true,
  );
  expect(result.colors.some(([r, g, b]) => g - r > 20 && g - b > 15)).toBe(
    true,
  );
  expect(result.counts.reduce((sum, count) => sum + count, 0)).toBe(1024);
  expect(quantize(input, 4)).toEqual(result);
  expect([...input]).toEqual(samples);
});

// @spec ARTWORK-006, ARTWORK-011, ARTWORK-018
it("keeps photographed colors exact in Full RGB and respects larger palette capacity", () => {
  const input = new Uint8Array(samples);
  const result = quantize(input, 16);
  expect(result.colors.length).toBeLessThanOrEqual(16);
  expect(result.colors.some(([r, g, b]) => r - g > 40 && r - b > 40)).toBe(
    true,
  );
  expect(result.colors.some(([r, g, b]) => g - r > 20 && g - b > 15)).toBe(
    true,
  );
  expect([...quantize(input, null).pixels]).toEqual(samples);
});

// @spec ARTWORK-007, ARTWORK-011
it("does not invent chromatic colors in grayscale drawings", () => {
  const input = new Uint8Array(
    Array.from({ length: 256 }, (_, v) => [v, v, v]).flat(),
  );
  for (const k of [2, 4, 16]) {
    const result = quantize(input, k);
    expect(result.colors.length).toBeLessThanOrEqual(k);
    for (const [r, g, b] of result.colors) expect([r, b]).toEqual([g, g]);
  }
});
