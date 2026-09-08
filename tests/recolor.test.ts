import { expect, it } from "vitest";
import samples from "./fixtures/crayon-samples.json";
import {
  quantize,
  recolorGroups,
  suggestGroupTargets,
  type RGB,
} from "../src/core/artwork";
import { resolveGroupTargets } from "../src/core/recolor";
const cherry: RGB[] = [
  [252, 222, 234],
  [255, 77, 109],
  [38, 89, 53],
  [1, 40, 36],
];
// @spec ARTWORK-041
it("suggests pigment targets without forcing two paper shades onto different colors", () => {
  const groups = quantize(new Uint8Array(samples), 4);
  expect(suggestGroupTargets(groups.colors, cherry)).toEqual([0, 0, 1, 2]);
  expect(
    suggestGroupTargets(
      [[10, 20, 30]],
      [
        [10, 20, 30],
        [255, 255, 255],
      ],
    ),
  ).toEqual([0]);
  expect(
    suggestGroupTargets(
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
    ),
  ).toEqual([0, 1]);
});
// @spec ARTWORK-042
it("recolors whole source groups while preserving every red and green cell", () => {
  const groups = quantize(new Uint8Array(samples), 4);
  const targets = [cherry[0], cherry[0], cherry[1], cherry[2]];
  const result = recolorGroups(groups, targets);
  for (let i = 0; i < groups.pixels.length; i += 3) {
    const group = groups.colors.findIndex((c) =>
      c.every((v, j) => v === groups.pixels[i + j]),
    );
    expect([...result.pixels.slice(i, i + 3)]).toEqual(targets[group]);
  }
  expect(
    result.counts[
      result.colors.findIndex((c) => c.join() === cherry[1].join())
    ],
  ).toBe(groups.counts[2]);
  expect(
    result.counts[
      result.colors.findIndex((c) => c.join() === cherry[2].join())
    ],
  ).toBe(groups.counts[3]);
  expect(result.colors).toHaveLength(3);
  expect(() => recolorGroups(groups, targets.slice(1))).toThrow();
});
// @spec ARTWORK-043, ARTWORK-044
it("keeps overrides attached to target entries and detects disabled targets", () => {
  const groups = quantize(new Uint8Array(samples), 4);
  const colors = cherry.map((c) => ({
    hex: c.map((v) => v.toString(16).padStart(2, "0")).join(""),
    enabled: true,
  }));
  const override = { [groups.colors[2].join(",")]: 1 };
  const original = resolveGroupTargets(groups.colors, colors, override);
  expect(original.valid).toBe(true);
  expect(original.targets[2]).toEqual(cherry[1]);
  colors[1] = { hex: "bb2244", enabled: true };
  expect(
    resolveGroupTargets(groups.colors, colors, override).targets[2],
  ).toEqual([187, 34, 68]);
  colors[1].enabled = false;
  const invalid = resolveGroupTargets(groups.colors, colors, override);
  expect(invalid.valid).toBe(false);
  expect(invalid.indices[2]).toBe(-1);
  expect(resolveGroupTargets(groups.colors, colors, {}).valid).toBe(true);
});
