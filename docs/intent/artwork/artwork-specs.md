# Artwork Requirements

Design: [Artwork](artwork-design.md). Unchecked requirements are active implementation gaps.

## Controls and Source Data

- [x] **ARTWORK-001**: When artwork controls initialize in a fresh session, they shall default to Full RGB and export scale 1×.
- [x] **ARTWORK-002**: The artwork view shall provide a crisp pixel preview, palette-size control with Full RGB and integer capacities from 2 through 16,777,216, capacity shortcuts 2, 4, 16, and 256, read-only inferred swatches, actual distinct-color count, export scale, final dimensions, and Download PNG without preset or user-selected colors.
- [x] **ARTWORK-003**: If palette capacity or export scale input is empty, nonnumeric, nonfinite, fractional, or outside its permitted range, then the artwork view shall show an inline error and disable the affected calculation or download without rounding or clamping the entry.
- [x] **ARTWORK-004**: When displaying an inferred palette, the artwork view shall show at most 64 swatches while reporting the total number of used output colors, including in Full RGB mode.
- [x] **ARTWORK-005**: The artwork processor shall preserve the immutable source drawing's N × N logical dimensions and source revision independently of palette capacity and PNG export scale.

## Inferred Colors

- [x] **ARTWORK-006**: When Full RGB is selected or palette capacity K is at least the number U of distinct original sampled colors, the artwork processor shall return the original sampled RGB pixels exactly without inserting colors to fill capacity.
- [x] **ARTWORK-007**: When K is below the distinct sampled-color count, the quantizer shall infer representative colors from a histogram weighted by logical-cell frequency and use weighted squared Oklab distance as its approximation objective without reserving black, white, or another color.
- [x] **ARTWORK-008**: When initializing a reduced palette, the quantizer shall repeatedly split the splittable cluster with largest weighted squared error, break equal cluster-error ties by the smallest numeric RGB member, and split along the greatest weighted-variance Oklab axis with axis ties resolved L then a then b.
- [x] **ARTWORK-009**: When splitting an initialization cluster, the quantizer shall sort by the selected Oklab coordinate and then numeric RGB, split after the first nonterminal entry reaching half the cumulative cluster weight or otherwise after the last nonterminal entry, and stop with K nonempty clusters whose weighted means initialize representatives.
- [x] **ARTWORK-010**: When refining a reduced palette, the quantizer shall run at most 12 Lloyd iterations with nearest-representative assignment, representative-index distance ties, weighted-mean updates, retained representatives for empty clusters, early termination on unchanged assignments, and selection of the earliest candidate having the minimum objective among initialization and iterations.
- [x] **ARTWORK-011**: When finalizing reduced colors, the quantizer shall convert representatives to sRGB, clamp channels to gamut, round to 8-bit values, deduplicate identical RGB representatives, and map original samples to nearest finalized representatives in Oklab without dithering, reporting only colors actually used and never more than K.
- [x] **ARTWORK-012**: When the sampled drawing contains only distinct green and blue colors and capacity is two, the artwork processor shall preserve those colors exactly; when the samples form varying green and blue groups, it shall derive representatives using the same image-based quantization objective without substituting a black-and-white palette.
- [x] **ARTWORK-013**: When uncolored cells are included in Scanner's RGB samples, the quantizer shall weight their sampled paper colors by cell frequency in the same manner as drawn colors without reserving a paper-color slot.

## Recalculation and Cancellation

- [x] **ARTWORK-014**: When a valid reduced palette capacity changes and no completed result is cached for the current sampled source revision and capacity, the artwork view shall debounce calculation by 150 ms, recompute from the original sampled drawing, mark any retained preview as updating, and disable download until the requested source revision and palette result match.
- [x] **ARTWORK-015**: When current source samples change, the artwork processor shall invalidate prior palette work and retain the user's palette and export-scale preferences, subject to validation against the new dimensions; when export scale alone changes, it shall not rerun quantization.
- [x] **ARTWORK-016**: The reduced-palette calculation shall run in a browser worker with request IDs and source revisions, and the artwork view shall ignore superseded responses and display activity and Cancel during calculation.
- [x] **ARTWORK-017**: If palette calculation fails, is cancelled, or reaches 15 seconds, then the artwork processor shall terminate ongoing computation as necessary, preserve original samples, label retained output as the previous result, disable download, and offer Retry and Full RGB.
- [x] **ARTWORK-018**: When Full RGB is selected after a reduced palette, the artwork processor shall restore original sampled RGB values without accumulated quantization loss.

## Local Palette Cache

- [x] **ARTWORK-026**: When reduced-palette calculation completes successfully for the current source revision and request ID, the artwork processor shall cache immutable logical RGB pixels, inferred colors, and usage counts in browser memory keyed by source revision and requested capacity.
- [x] **ARTWORK-027**: When the user selects a capacity cached for the current valid sampled drawing, the artwork view shall immediately restore its identical logical preview, swatches, and usage counts without debounce or quantizer execution and shall enable download if export settings are valid.
- [x] **ARTWORK-028**: When the user changes palette capacity, including to a cached result or Full RGB, the artwork processor shall cancel pending debounce, invalidate outstanding request IDs, and terminate obsolete computation so its result or timeout cannot replace the newly selected preview or populate the cache.
- [x] **ARTWORK-029**: When selecting Full RGB or a capacity at least the original distinct-color count, the artwork view shall reuse a shared original-color result while retaining the selected capacity separately and without allocating duplicate cached pixel buffers for those capacities.
- [x] **ARTWORK-030**: The palette cache shall retain at most 32 reduced-palette results using least-recently-used eviction with insertion and selection updating recency, keep original colors outside that entry limit, and recompute evicted capacities from source when selected again.
- [x] **ARTWORK-031**: When sampled source data is invalidated or replaced, the artwork processor shall clear cached palette results; when only export scale changes or the user navigates between Create and Scan, it shall retain them; when the page reloads, it shall start with an empty cache without persistent browser artwork storage.
- [x] **ARTWORK-032**: The palette cache shall exclude enlarged canvases and encoded PNGs, remain unchanged by PNG export, and reject failed, cancelled, timed-out, or superseded calculation results.

## PNG Export

- [x] **ARTWORK-019**: When validating PNG scale s for logical size N, the exporter shall accept only positive safe integers through floor(4096/N), calculate W=H=N×s before allocation, and display the resulting dimensions without silently reducing invalid sizes.
- [x] **ARTWORK-020**: When exporting at valid scale s, the exporter shall produce a PNG of exactly (N×s) × (N×s) pixels with each logical pixel replicated into an exact s × s same-color block, alpha 255, and no smoothing or additional colors.
- [x] **ARTWORK-021**: The exporter shall treat palette capacity as an output distinct-color bound independently of the browser PNG encoder's storage bit depth.
- [x] **ARTWORK-022**: When Download PNG is selected for current valid artwork, the exporter shall snapshot logical pixels, source revision, N, palette settings, and scale and disable repeated download actions during encoding.
- [x] **ARTWORK-023**: If artwork samples or export-affecting settings change during PNG encoding, then the exporter shall discard the pending encoded result and require a new download action for the current state.
- [x] **ARTWORK-024**: If PNG allocation or encoding fails or the encoder returns no image, then the exporter shall preserve artwork and show a recoverable failure suggesting a lower scale.
- [x] **ARTWORK-025**: When PNG encoding succeeds for unchanged current settings, the exporter shall initiate a local download named `pixel-art-<N>x<N>-<s>x.png` and release the temporary object URL after allowing the browser to consume it, without uploading artwork.
