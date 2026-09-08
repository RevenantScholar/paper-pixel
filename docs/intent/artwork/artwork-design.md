---
parent: high-level-design
prefix: ARTWORK
---

# Artwork

## Context and Design Philosophy

Artwork converts scanned logical RGB cells into an inferred or selected palette and exports crisp PNGs at a user-selected scale. Palette capacity and output dimensions are independent. Original samples remain available so every change starts from the same drawing.

## Interface and Data

Show a pixelated preview, a Palette size control, read-only inferred swatches with the actual distinct-color count, an Export scale number input, final PNG dimensions, and Download PNG. Palette choices include Full RGB and a custom integer color count. Quick choices 2 (1-bit), 4 (2-bit), 16 (4-bit), and 256 (8-bit) are shortcuts to counts, not predefined colors. Default to Full RGB and export scale 1×.

Accept K from 2 to 16,777,216. K is a capacity; the number of useful colors cannot exceed N² or the distinct sampled-color count. Full RGB bypasses reduction. Counts at or above the number of distinct samples also preserve the original samples exactly. Blank or invalid numeric input shows an inline error and disables the affected operation without clamping. From photo mode shows read-only inferred swatches; Choose palette provides editable imported colors.

Input is immutable `SampledDrawing` from Scanner. Output contains the same N, row-major RGB pixel bytes, palette mode/capacity, inferred colors and usage counts, and source revision. Scaling belongs only to export and does not alter these logical pixels. Color swatches summarize output colors, including full-RGB output, but the UI shows at most 64 swatches with the total count to keep large palettes usable.

## Palette Inference

Build a histogram of exact sampled RGB colors, weighted by how many logical cells contain each color. If the unique count U is at most K, return the original pixels. Otherwise convert unique colors to Oklab and minimize the frequency-weighted sum of color-sensitive squared Oklab distances, defined as ΔL² + 8Δa² + 8Δb² to the representative palette. Weighting each chromatic axis eight times as strongly as lightness helps keep distinct pigment hues separate under limited capacity while retaining photographed lightness and image-derived centroids. It does not increase output saturation directly. This defines the meaning of a good representation; the bounded algorithm approximates the minimum and does not claim a globally optimal solution.

Initialize by deterministic weighted median splitting. Repeatedly select the splittable cluster with the largest total color-sensitive squared error around its weighted mean. Split along its largest frequency-weighted Oklab variance multiplied by that axis’s distance weight (1 for L, 8 for a and b) at the weighted median between distinct entries, leaving both children nonempty. Resolve ties by axis order L, a, b and then numeric RGB order. Order clusters with equal splitting error by their smallest numeric RGB member. Choose the first nonterminal sorted entry whose cumulative weight reaches half the cluster weight as the split boundary; if none does, use the last nonterminal entry. Stop at K clusters. Use their weighted centroids as initial representatives.

Refine with up to 12 deterministic Lloyd iterations: assign each distinct color to its nearest representative under the same color-sensitive distance and recompute weighted means. Use representative index for equal-distance ties, retain an empty cluster's previous representative, and stop early when assignments do not change. Keep the candidate with the smallest objective among initialization and refinement iterations, retaining the earliest candidate on equal objective. Bound processing in a worker and support cancellation with revision IDs. The provisional grid ceiling bounds U at 4096; requests with larger K take the exact-preservation branch.

Convert centroids to sRGB, clamp out-of-gamut channels, and round to 8-bit channels. Remove duplicate rounded representatives, then assign every original sampled color to the nearest finalized representative using the same color-sensitive Oklab distance. Report only colors actually used. This ensures output uses at most K colors even when rounding merges representatives. No dithering is applied: each logical cell maps to one solid representative color.

Green and blue samples with variation should form representative green and blue groups under a two-color capacity. Black and white have no privileged role. Each blank cell participates using Scanner's sampled paper color; markers, margins, and grid lines are absent from the input.

## Recalculation and State

On a valid palette-size change, first check the current drawing's local palette cache. A hit immediately restores the calculated logical pixels, inferred swatches, and usage counts, with no debounce or quantization. Enable download when the restored result and export settings are valid. A miss starts from original samples, never from a previous quantized result: debounce calculation by 150 ms, mark the existing preview as updating, and disable download until the matching revision is ready. Ignore superseded worker responses. On computation failure preserve the source drawing and expose retry and Full RGB. New or invalidated source samples invalidate prior palette work and clear the cache; keep the user's valid palette capacity and export scale preferences.

Changing export scale does not rerun quantization. Returning to Full RGB restores the original sampled RGB exactly. The palette worker uses its own request IDs and is terminated on cancellation or a 15-second timeout. After cancellation or timeout, label any retained preview as the previous result, keep download disabled, and offer Retry and Full RGB. Show progress and Cancel while running. Provisional performance target: a 32 × 32 input reduced to 16 colors within one second on representative phones; measure before claiming it.

## Local Palette Cache

Cache completed results in browser memory for the current sampled drawing, keyed by sampled-drawing revision and requested reduced capacity K in From photo mode, or by ordered active RGB values and metric version in Choose palette mode. That revision changes on sampling geometry or orientation edits even if the photo is unchanged. Store immutable logical RGB pixels plus inferred colors and usage counts, so repeated comparisons restore identical output. Cache entries contain no enlarged canvas or encoded PNG. Export scale is not part of the key. Full RGB and capacities K≥U share the original-color result; keep the selected capacity separately for display and export validation.

Keep up to 32 completed reduced or selected-palette entries using least-recently-used eviction, touching an entry on insertion or selection. Pin the original-color result outside this limit. With N≤64, compact RGB and usage-count arrays keep this bounded independently of enlarged export size. Revisiting an evicted capacity recalculates from source. Preserve the cache when navigating between Create and Scan, but clear it when the sampled source becomes invalid, is replaced, or the page reloads. Do not persist artwork in localStorage or IndexedDB. Imported palette definitions and their edited colors may persist separately.

Switching to another capacity cancels pending debounce and supersedes any running request, including when the new choice is cached or Full RGB. Terminate obsolete worker computation before restoring a cached preview so an old timeout cannot replace it with an error. Cache only successful results whose source revision and request ID are still current. Failed, cancelled, timed-out, and late results must not create entries. Cache reads are immutable and PNG export cannot modify cached pixels.

## PNG Export

Accept positive integer scale s, including 3× and 5×, with default 1×. Show W = H = N × s before downloading. Use a maximum dimension of 4096 pixels; therefore valid s is 1 through floor(4096/N). Validate using finite safe integers before allocating. Larger exports fail validation visibly and never silently use a smaller scale. The ceiling is an initial resource bound, not a claim that every phone can allocate its largest permitted image.

Replicate each logical pixel into an exact s × s block with alpha 255. Canvas drawing uses image smoothing disabled and integer coordinates. PNG encoding returns an opaque lossless image with exactly W × H pixels. Palette capacity refers to artwork colors, not PNG file storage bit depth: a two-color image may be encoded as an RGBA PNG by the browser.

The export operation snapshots the current logical output, N, and s. Disable repeated downloads while encoding. If artwork settings change during encoding, discard the pending result and let the user export the new state. Handle allocation failure and a null/failed encoder result with a message suggesting a lower scale, preserving the artwork. Create a local download named `pixel-art-<N>x<N>-<s>x.png` and release its object URL after the browser has had time to consume it. Browser-native save/share behavior may differ; no server upload is involved.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Color objective | Frequency-weighted Oklab distance ΔL² + 8Δa² + 8Δb² | Equal-axis Oklab; RGB channel distance; direct saturation enhancement | Prioritizes separation of pigment hues over small brightness variations without manufacturing saturated colors. Equal-axis distance can merge distinct hues with similar lightness on paper-heavy drawings. |
| Quantizer | Deterministic median initialization plus bounded Lloyd refinement | Random initialization; most frequent colors | Consolidates color variations reproducibly while refining representation quality. |
| Palette control | From photo with arbitrary capacity/Full RGB, or editable selected colors | Bit-depth-only presets; inferred-only workflow | Supports automatic extraction and deliberate palette styling independently. |
| Palette comparison | Session-memory cache of 32 reduced results plus original colors | Recompute every toggle; persistent browser storage | Makes repeated comparisons immediate with bounded memory and the existing fresh-session behavior. |
| Enlargement | Integer pixel replication | Fractional resizing; interpolation | Keeps every source pixel equally sized and avoids adding colors. |
| Export bound | 4096-pixel side ceiling | Unlimited; fixed scale presets | Bounds allocation while supporting arbitrary integer enlargement within that limit. |

## Behavioral Requirements

The component's behavioral requirements are defined in [artwork-specs.md](artwork-specs.md), using the `ARTWORK-*` namespace.

## Verification Design

Test a sampled textured red/green drawing with dominant paper variations at three, four, and sixteen colors, shadowed blank-cell assignment to the same representative as brighter paper at three colors while preserving red and green drawing regions, chromatic separation at four colors, grayscale-only inputs, deterministic output, and exact Full RGB restoration. Test exact green/blue and varied green/blue fixtures; one-color input with K=2; preservation when K≥U; deterministic output; output capacity after centroid rounding; exclusion of no colors by special treatment; and Full RGB restoration after palette changes. Compare objective improvement on controlled fixtures, without requiring a global optimum. Test worker cancellation, stale results, and encoder failure.

Test 2→4→2 comparisons for identical cached pixels and no second quantizer call, immediate cache hits during another pending calculation, cache reuse across navigation and export-scale changes, least-recently-used eviction, original-color result sharing, and clearing after source invalidation. Verify cancelled and stale responses never populate the cache or overwrite a restored preview.

Decode exported PNGs to verify dimensions and every replicated pixel for multiple N and scales 1, 2, 3, and the resource boundary. Verify color-count preservation and opaque alpha. Form tests cover empty, nonfinite, fractional, negative, and oversized entries. Browser integration verifies responsive preview, keyboard controls, and usable download behavior.

## Open Questions & Future Decisions

- Validate memory use at the 4096-pixel export ceiling on representative phones.
- Benchmark high unique-color counts and capacities; tighten resource bounds or optimize the quantizer if needed while retaining the same palette-size behavior.

## References

- [High-level design](../../high-level-design.md)
- [Scanner](../scanner/scanner-design.md)
- [Oklab by its author](https://bottosson.github.io/posts/oklab/)

## Lospec Import and Editing

Place a From photo / Choose palette mode switch above the palette controls. Default to From photo. Choose palette provides a labeled Lospec URL or slug input, Load palette, and a Browse palettes on Lospec link opening `https://lospec.com/palette-list` in a new tab with noopener/noreferrer. Explain that a URL or slug such as pico-8 is needed; arbitrary display-name search is unavailable. Keep input and actions stacked on phones, with at least 44px touch targets and no horizontal overflow at 320px.

Parse only canonical palette slugs or HTTP(S) URLs on lospec.com/www.lospec.com with path /palette-list/<slug> and optional .json/trailing slash. Reject credentials, ports, other domains, and malformed paths. Build a fixed HTTPS JSON URL. Fetch with credentials omitted and no referrer; do not send drawing data. Enforce a ten-second timeout and 64KiB streamed response limit. Accept a bounded name/author plus 2–256 valid six-digit hex colors; normalize case and deduplicate for mapping, requiring at least two distinct enabled colors. Handle invalid input, 404, rate limits, network failure, bad JSON, and invalid colors visibly. Only successful current requests replace the selected palette; cancellation, changed input, mode changes, edits/resets, and selecting a saved palette supersede outstanding imports. A failed import retains the current selection.

Show palette name, source attribution/link, active count, and a remembered-palette select. Store at most 16 recently selected/imported definitions with their current edited colors and originals under a versioned localStorage key; validate restored records. Storage corruption, denial, or quota failure leaves session functionality available. Saving definitions never saves pixel buffers or photographs. Reimporting an existing slug resets its edited copy to the newly fetched original. A fresh session still opens From photo. Switching views retains the in-memory library, editing history, and selection.

A compact live artwork preview sits above the group and palette editing controls. A collapsible Edit colors section exposes labeled enabled checkboxes, native color inputs, and hex inputs per swatch. Edits preview live with the existing debounce; invalid hex or fewer than two enabled distinct colors disables palette mapping/export and labels retained output as previous. Add color appends a white editable swatch without privileging white during mapping, up to 256 entries. Undo restores up to 32 prior edits; Reset restores imported originals. Disabled valid colors remain in the editable copy but not the active set. Persist only valid edited copies; invalid intermediate text remains session-only. Label modified copies Edited and preserve attribution. Report selected count separately from actually used output colors.

Closest colors mapping uses original scanner samples and the same weighted Oklab metric as inference, with first palette entry breaking equal-distance ties. Preserve exact selected RGB values: no centroids, dithering, or K≥U bypass. Run mapping in the existing worker with cancellation/timeout contracts. Cache the result by source revision and a versioned ordered active-color key, not palette name or count. Undoing to a prior active set restores cached output. Switching mode or editing colors invalidates pending PNG encoding and supersedes obsolete workers. Export scaling remains independent. Full RGB recovery switches back to From photo.

## Bundled Palette Catalog

Bundle six palettes for each preset size 2, 4, 16, and 256 (24 total), selected from Lospec's exact-size results sorted by downloads on 2026-09-08. Keep original hex entries, title, source slug, attribution type, and author/submitter. Show color-count filtering and name/author search over the bundled catalog only, with six vertically scrollable swatch cards per size. Start the catalog filter at 16 colors. Selecting a card applies its remembered edited copy if available, otherwise the original; Reset returns to bundled originals. Bundled cards require no runtime network request. Download rank is a dated snapshot, not a live popularity claim. Source metadata and query provenance live with the catalog. The metadata-fetch script is a maintenance operation, not a runtime search dependency.

## Group Recoloring

Choose palette defaults to Recolor groups, with Closest colors available as a direct-sample alternative. Drawing colors uses the same inferred count as From photo, accepting 2–256 for group mode; when From photo is Full RGB, group mode starts at four without changing the Full RGB preference until edited. The group count is independent of target palette capacity. Infer groups from immutable scanner samples using the existing quantizer and retain their colors, counts, and cell memberships. Every member of a group receives its assigned target RGB exactly. Several groups may share a target, and target entries may remain unused. No algorithm claims to recover detail absent from sampling.

Suggest initial group targets by retaining exact RGB matches where available; otherwise compare each source centroid to target colors with the existing weighted Oklab metric after scaling source a/b by the ratio of maximum target chroma to maximum source chroma, clamped to 0.25–4, with a 0.02 source-chroma floor. Lightness is unchanged. These suggestions align pigment saturation ranges without transforming output colors; they are editable starting points, not a guarantee of contrast preservation. There is no one-to-one assignment requirement or reserved paper target. Ties use target order.

Show source-swatch → target-swatch rows with cell counts, a nearby live preview, and an expandable grid of at least 44px target buttons for the active row. Only enabled target colors can be chosen. Reset mappings restores suggestions. User overrides refer to original palette entry indexes, so editing a target color updates all groups assigned to that entry. If an assigned entry is disabled, show a missing-target row and disable export until reassigned or reset; never silently move an override to another entry. Suggestions for untouched rows can update with target edits. Invalid palette text continues to disable output.

Store overrides only in session memory, scoped by drawing revision, inferred count, and palette slug, with at most 32 contexts. Switching modes/methods preserves applicable overrides; changing source, count, or palette uses that context's own mappings. No mapping or source color data enters persisted palette definitions. Cached inferred groups are reusable independently of output mappings. Mapping-result keys include method, source revision, group count, enabled target values, and resolved ordered assignments. Group assignment changes reuse the grouped source rather than rerunning quantization, supersede pending work, and invalidate PNG encoding. Closest colors retains its original direct mapping cache and behavior. From photo and Full RGB remain recoverable.

Source invalidation clears all session mapping contexts. Current group rows appear only when inference matches the current source and drawing-color count.

The inference and selected-output caches each hold up to 32 LRU entries, so target edits cannot evict source groups. Original-color results remain outside these limits.
