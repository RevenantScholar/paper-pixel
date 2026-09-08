---
parent: high-level-design
prefix: ARTWORK
---

# Artwork

## Context and Design Philosophy

Artwork converts scanned logical RGB cells into a compact inferred palette and exports crisp PNGs at a user-selected scale. Palette capacity and output dimensions are independent. Original samples remain available so every change starts from the same drawing.

## Interface and Data

Show a pixelated preview, a Palette size control, read-only inferred swatches with the actual distinct-color count, an Export scale number input, final PNG dimensions, and Download PNG. Palette choices include Full RGB and a custom integer color count. Quick choices 2 (1-bit), 4 (2-bit), 16 (4-bit), and 256 (8-bit) are shortcuts to counts, not predefined colors. Default to Full RGB and export scale 1×.

Accept K from 2 to 16,777,216. K is a capacity; the number of useful colors cannot exceed N² or the distinct sampled-color count. Full RGB bypasses reduction. Counts at or above the number of distinct samples also preserve the original samples exactly. Blank or invalid numeric input shows an inline error and disables the affected operation without clamping. No color picker, preset palette, or editable swatch is exposed.

Input is immutable `SampledDrawing` from Scanner. Output contains the same N, row-major RGB pixel bytes, palette mode/capacity, inferred colors and usage counts, and source revision. Scaling belongs only to export and does not alter these logical pixels. Color swatches summarize output colors, including full-RGB output, but the UI shows at most 64 swatches with the total count to keep large palettes usable.

## Palette Inference

Build a histogram of exact sampled RGB colors, weighted by how many logical cells contain each color. If the unique count U is at most K, return the original pixels. Otherwise convert unique colors to Oklab and minimize the frequency-weighted sum of color-sensitive squared Oklab distances, defined as ΔL² + 4Δa² + 4Δb² to the representative palette. Weighting each chromatic axis four times as strongly as lightness helps keep distinct pigment hues separate under limited capacity while retaining photographed lightness and image-derived centroids. It does not increase output saturation directly. This defines the meaning of a good representation; the bounded algorithm approximates the minimum and does not claim a globally optimal solution.

Initialize by deterministic weighted median splitting. Repeatedly select the splittable cluster with the largest total color-sensitive squared error around its weighted mean. Split along its largest frequency-weighted Oklab variance multiplied by that axis’s distance weight (1 for L, 4 for a and b) at the weighted median between distinct entries, leaving both children nonempty. Resolve ties by axis order L, a, b and then numeric RGB order. Order clusters with equal splitting error by their smallest numeric RGB member. Choose the first nonterminal sorted entry whose cumulative weight reaches half the cluster weight as the split boundary; if none does, use the last nonterminal entry. Stop at K clusters. Use their weighted centroids as initial representatives.

Refine with up to 12 deterministic Lloyd iterations: assign each distinct color to its nearest representative under the same color-sensitive distance and recompute weighted means. Use representative index for equal-distance ties, retain an empty cluster's previous representative, and stop early when assignments do not change. Keep the candidate with the smallest objective among initialization and refinement iterations, retaining the earliest candidate on equal objective. Bound processing in a worker and support cancellation with revision IDs. The provisional grid ceiling bounds U at 4096; requests with larger K take the exact-preservation branch.

Convert centroids to sRGB, clamp out-of-gamut channels, and round to 8-bit channels. Remove duplicate rounded representatives, then assign every original sampled color to the nearest finalized representative using the same color-sensitive Oklab distance. Report only colors actually used. This ensures output uses at most K colors even when rounding merges representatives. No dithering is applied: each logical cell maps to one solid representative color.

Green and blue samples with variation should form representative green and blue groups under a two-color capacity. Black and white have no privileged role. Each blank cell participates using Scanner's sampled paper color; markers, margins, and grid lines are absent from the input.

## Recalculation and State

On a valid palette-size change, first check the current drawing's local palette cache. A hit immediately restores the calculated logical pixels, inferred swatches, and usage counts, with no debounce or quantization. Enable download when the restored result and export settings are valid. A miss starts from original samples, never from a previous quantized result: debounce calculation by 150 ms, mark the existing preview as updating, and disable download until the matching revision is ready. Ignore superseded worker responses. On computation failure preserve the source drawing and expose retry and Full RGB. New or invalidated source samples invalidate prior palette work and clear the cache; keep the user's valid palette capacity and export scale preferences.

Changing export scale does not rerun quantization. Returning to Full RGB restores the original sampled RGB exactly. The palette worker uses its own request IDs and is terminated on cancellation or a 15-second timeout. After cancellation or timeout, label any retained preview as the previous result, keep download disabled, and offer Retry and Full RGB. Show progress and Cancel while running. Provisional performance target: a 32 × 32 input reduced to 16 colors within one second on representative phones; measure before claiming it.

## Local Palette Cache

Cache completed results in browser memory for the current sampled drawing, keyed by sampled-drawing revision and requested reduced capacity K. That revision changes on sampling geometry or orientation edits even if the photo is unchanged. Store immutable logical RGB pixels plus inferred colors and usage counts, so repeated comparisons restore identical output. Cache entries contain no enlarged canvas or encoded PNG. Export scale is not part of the key. Full RGB and capacities K≥U share the original-color result; keep the selected capacity separately for display and export validation.

Keep up to 32 completed reduced-palette entries using least-recently-used eviction, touching an entry on insertion or selection. Pin the original-color result outside this limit. With N≤64, compact RGB and usage-count arrays keep this bounded independently of enlarged export size. Revisiting an evicted capacity recalculates from source. Preserve the cache when navigating between Create and Scan, but clear it when the sampled source becomes invalid, is replaced, or the page reloads. Do not persist artwork in localStorage or IndexedDB.

Switching to another capacity cancels pending debounce and supersedes any running request, including when the new choice is cached or Full RGB. Terminate obsolete worker computation before restoring a cached preview so an old timeout cannot replace it with an error. Cache only successful results whose source revision and request ID are still current. Failed, cancelled, timed-out, and late results must not create entries. Cache reads are immutable and PNG export cannot modify cached pixels.

## PNG Export

Accept positive integer scale s, including 3× and 5×, with default 1×. Show W = H = N × s before downloading. Use a maximum dimension of 4096 pixels; therefore valid s is 1 through floor(4096/N). Validate using finite safe integers before allocating. Larger exports fail validation visibly and never silently use a smaller scale. The ceiling is an initial resource bound, not a claim that every phone can allocate its largest permitted image.

Replicate each logical pixel into an exact s × s block with alpha 255. Canvas drawing uses image smoothing disabled and integer coordinates. PNG encoding returns an opaque lossless image with exactly W × H pixels. Palette capacity refers to artwork colors, not PNG file storage bit depth: a two-color image may be encoded as an RGBA PNG by the browser.

The export operation snapshots the current logical output, N, and s. Disable repeated downloads while encoding. If artwork settings change during encoding, discard the pending result and let the user export the new state. Handle allocation failure and a null/failed encoder result with a message suggesting a lower scale, preserving the artwork. Create a local download named `pixel-art-<N>x<N>-<s>x.png` and release its object URL after the browser has had time to consume it. Browser-native save/share behavior may differ; no server upload is involved.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Color objective | Frequency-weighted Oklab distance ΔL² + 4Δa² + 4Δb² | Equal-axis Oklab; RGB channel distance; direct saturation enhancement | Prioritizes separation of pigment hues over small brightness variations without manufacturing saturated colors. Equal-axis distance can merge distinct hues with similar lightness on paper-heavy drawings. |
| Quantizer | Deterministic median initialization plus bounded Lloyd refinement | Random initialization; most frequent colors | Consolidates color variations reproducibly while refining representation quality. |
| Palette control | Arbitrary integer capacity and Full RGB | Bit-depth-only presets; manual color selection | Matches user control over size while calculating the colors from the image. |
| Palette comparison | Session-memory cache of 32 reduced results plus original colors | Recompute every toggle; persistent browser storage | Makes repeated comparisons immediate with bounded memory and the existing fresh-session behavior. |
| Enlargement | Integer pixel replication | Fractional resizing; interpolation | Keeps every source pixel equally sized and avoids adding colors. |
| Export bound | 4096-pixel side ceiling | Unlimited; fixed scale presets | Bounds allocation while supporting arbitrary integer enlargement within that limit. |

## Behavioral Requirements

The component's behavioral requirements are defined in [artwork-specs.md](artwork-specs.md), using the `ARTWORK-*` namespace.

## Verification Design

Test a sampled textured red/green drawing with dominant paper variations at four and sixteen colors, chromatic separation at four colors, grayscale-only inputs, deterministic output, and exact Full RGB restoration. Test exact green/blue and varied green/blue fixtures; one-color input with K=2; preservation when K≥U; deterministic output; output capacity after centroid rounding; exclusion of no colors by special treatment; and Full RGB restoration after palette changes. Compare objective improvement on controlled fixtures, without requiring a global optimum. Test worker cancellation, stale results, and encoder failure.

Test 2→4→2 comparisons for identical cached pixels and no second quantizer call, immediate cache hits during another pending calculation, cache reuse across navigation and export-scale changes, least-recently-used eviction, original-color result sharing, and clearing after source invalidation. Verify cancelled and stale responses never populate the cache or overwrite a restored preview.

Decode exported PNGs to verify dimensions and every replicated pixel for multiple N and scales 1, 2, 3, and the resource boundary. Verify color-count preservation and opaque alpha. Form tests cover empty, nonfinite, fractional, negative, and oversized entries. Browser integration verifies responsive preview, keyboard controls, and usable download behavior.

## Open Questions & Future Decisions

- Validate memory use at the 4096-pixel export ceiling on representative phones.
- Benchmark high unique-color counts and capacities; tighten resource bounds or optimize the quantizer if needed while retaining the same palette-size behavior.

## References

- [High-level design](../../high-level-design.md)
- [Scanner](../scanner/scanner-design.md)
- [Oklab by its author](https://bottosson.github.io/posts/oklab/)
