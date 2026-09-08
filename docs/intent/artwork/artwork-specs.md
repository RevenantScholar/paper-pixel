# Artwork Requirements

Design: [Artwork](artwork-design.md). Unchecked requirements are active implementation gaps.

## Controls and Source Data

- [x] **ARTWORK-001**: When artwork controls initialize in a fresh session, they shall default to Full RGB and export scale 1×.
- [x] **ARTWORK-002**: The artwork view shall provide a crisp pixel preview, palette-size control with Full RGB and integer capacities from 2 through 16,777,216, capacity shortcuts 2, 4, 16, and 256, read-only inferred swatches, actual distinct-color count, export scale, final dimensions, and Download PNG without preset or user-selected colors in From photo mode.
- [x] **ARTWORK-003**: If palette capacity or export scale input is empty, nonnumeric, nonfinite, fractional, or outside its permitted range, then the artwork view shall show an inline error and disable the affected calculation or download without rounding or clamping the entry.
- [x] **ARTWORK-004**: When displaying an inferred palette, the artwork view shall show at most 64 swatches while reporting the total number of used output colors, including in Full RGB mode.
- [x] **ARTWORK-005**: The artwork processor shall preserve the immutable source drawing's N × N logical dimensions and source revision independently of palette capacity and PNG export scale.

## Inferred Colors

- [x] **ARTWORK-006**: When From photo mode selects Full RGB or its palette capacity K is at least the number U of distinct original sampled colors, the artwork processor shall return the original sampled RGB pixels exactly without inserting colors to fill capacity.
- [x] **ARTWORK-007**: When From photo mode requests K below the distinct sampled-color count, the quantizer shall infer representative colors from a histogram weighted by logical-cell frequency and use frequency-weighted squared Oklab distance ΔL² + 8Δa² + 8Δb² as its approximation objective without reserving black, white, or another color.
- [x] **ARTWORK-008**: When initializing a reduced palette, the quantizer shall repeatedly split the splittable cluster with largest frequency-weighted error under ΔL² + 8Δa² + 8Δb², break equal cluster-error ties by the smallest numeric RGB member, and split along the greatest frequency-weighted Oklab variance multiplied by axis weights L=1, a=8, b=8 with axis ties resolved L then a then b.
- [x] **ARTWORK-009**: When splitting an initialization cluster, the quantizer shall sort by the selected Oklab coordinate and then numeric RGB, split after the first nonterminal entry reaching half the cumulative cluster weight or otherwise after the last nonterminal entry, and stop with K nonempty clusters whose weighted means initialize representatives.
- [x] **ARTWORK-010**: When refining a reduced palette, the quantizer shall run at most 12 Lloyd iterations with nearest-representative assignment under ΔL² + 8Δa² + 8Δb², representative-index distance ties, weighted-mean updates, retained representatives for empty clusters, early termination on unchanged assignments, and selection of the earliest candidate having the minimum objective among initialization and iterations.
- [x] **ARTWORK-011**: When finalizing inferred reduced colors, the quantizer shall convert representatives to sRGB, clamp channels to gamut, round to 8-bit values, deduplicate identical RGB representatives, and map original samples to nearest finalized representatives under Oklab distance ΔL² + 8Δa² + 8Δb² without dithering, reporting only colors actually used and never more than K.
- [x] **ARTWORK-012**: When the sampled drawing contains only distinct green and blue colors and capacity is two, the artwork processor shall preserve those colors exactly; when the samples form varying green and blue groups, it shall derive representatives using the same image-based quantization objective without substituting a black-and-white palette.
- [x] **ARTWORK-013**: When uncolored cells are included in Scanner's RGB samples, the quantizer shall weight their sampled paper colors by cell frequency in the same manner as drawn colors without reserving a paper-color slot.

## Recalculation and Cancellation

- [x] **ARTWORK-014**: When a valid reduced palette capacity changes and no completed result is cached for the current sampled source revision and capacity, the artwork view shall debounce calculation by 150 ms, recompute from the original sampled drawing, mark any retained preview as updating, and disable download until the requested source revision and palette result match.
- [x] **ARTWORK-015**: When current source samples change, the artwork processor shall invalidate prior palette work and retain the user's palette and export-scale preferences, subject to validation against the new dimensions; when export scale alone changes, it shall not rerun quantization.
- [x] **ARTWORK-016**: The reduced-palette calculation shall run in a browser worker with request IDs and source revisions, and the artwork view shall ignore superseded responses and display activity and Cancel during calculation.
- [x] **ARTWORK-017**: If palette calculation fails, is cancelled, or reaches 15 seconds, then the artwork processor shall terminate ongoing computation as necessary, preserve original samples, label retained output as the previous result, disable download, and offer Retry and Full RGB.
- [x] **ARTWORK-018**: When Full RGB is selected after a reduced palette, the artwork processor shall restore original sampled RGB values without accumulated quantization loss.

## Local Palette Cache

- [x] **ARTWORK-026**: When reduced-palette calculation completes successfully for the current source revision and request ID, the artwork processor shall cache immutable logical RGB pixels, inferred colors, and usage counts in browser memory keyed by source revision and requested capacity for inferred results or versioned ordered active RGB values for selected results.
- [x] **ARTWORK-027**: When the user selects a capacity cached for the current valid sampled drawing, the artwork view shall immediately restore its identical logical preview, swatches, and usage counts without debounce or quantizer execution and shall enable download if export settings are valid.
- [x] **ARTWORK-028**: When the user changes palette capacity, including to a cached result or Full RGB, the artwork processor shall cancel pending debounce, invalidate outstanding request IDs, and terminate obsolete computation so its result or timeout cannot replace the newly selected preview or populate the cache.
- [x] **ARTWORK-029**: When From photo mode selects Full RGB or a capacity at least the original distinct-color count, the artwork view shall reuse a shared original-color result while retaining the selected capacity separately and without allocating duplicate cached pixel buffers for those capacities.
- [x] **ARTWORK-030**: The inference and selected-output caches shall each retain at most 32 results using least-recently-used eviction with insertion and selection updating recency, keep original colors outside that entry limit, and recompute evicted capacities from source when selected again.
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

## Selected Palettes

- [x] **ARTWORK-033**: The artwork view shall default to From photo, offer Choose palette with a Lospec URL/slug input and new-tab browse link, preserve both modes' settings across switching, and provide labeled controls usable at 320px without horizontal page scrolling.
- [x] **ARTWORK-034**: When loading a Lospec palette, the importer shall accept only supported Lospec URLs or slugs, fetch the canonical HTTPS JSON endpoint without credentials or artwork, enforce a ten-second timeout and 64KiB response limit, and validate 2–256 six-digit hex colors with at least two distinct values and bounded name/author strings.
- [x] **ARTWORK-035**: If an import fails, is cancelled, or is superseded by input, mode, edits/resets, or saved-selection changes, then it shall preserve the current palette and artwork, show a recoverable error for current failures, and prevent stale responses from replacing the selection.
- [x] **ARTWORK-036**: When Closest colors is active with a selected palette, the worker shall map each original sample to its nearest enabled color under ΔL²+8Δa²+8Δb², break ties by palette order, use only exact selected RGB values regardless of source distinct-color count, and reuse results by source revision and versioned ordered active-color key under existing cancellation and export-invalidation rules.
- [x] **ARTWORK-037**: The palette editor shall provide enable toggles, color and hex inputs, add up to 256 entries, 32-step undo, reset to imported colors, source attribution, and edited/active-count labels; invalid hex or fewer than two distinct enabled colors shall disable mapping/export, and valid edits shall update the preview from original samples.
- [x] **ARTWORK-038**: The palette library shall remember at most 16 recently selected/imported definitions with validated edited copies and originals in versioned local storage, preserve session functionality when storage fails, and never persist photographs, sampled pixels, or mapped artwork.

- [x] **ARTWORK-039**: Choose palette shall provide 24 locally bundled palettes, six each at 2, 4, 16, and 256 entries from a dated Lospec download-sorted snapshot, with source attribution, name/author search and size filters; selecting a bundled palette shall require no network request and restore a remembered edited copy when available.

## Group Recoloring

- [x] **ARTWORK-040**: Choose palette shall default to Recolor groups and offer Closest colors; group mode shall use the From photo inferred count with a four-group fallback for Full RGB, accept 2–256 drawing colors independently of target capacity, and show source colors and usage counts with editable target mappings at supported mobile widths.
- [x] **ARTWORK-041**: When suggesting group targets, the processor shall retain exact RGB matches first and otherwise choose nearest targets under weighted Oklab distance after scaling source chromatic axes by target/source maximum chroma ratio with source floor 0.02 and scale clamped 0.25–4, preserve lightness, and resolve ties by target order without requiring distinct targets.
- [x] **ARTWORK-042**: When recoloring groups, the worker shall replace every member of each inferred source group with that group's exact assigned enabled RGB color, preserve dimensions and source memberships, permit shared/unused targets, and reuse inferred groups on assignment changes.
- [x] **ARTWORK-043**: The group editor shall offer large enabled-target swatches and Reset mappings, retain explicit entry-index overrides through target color edits, disable export for disabled/missing override targets, and scope up to 32 session-only mapping contexts by drawing revision, group count, and palette slug.
- [x] **ARTWORK-044**: Group-result caching shall distinguish method, drawing revision, group count, enabled target values, and resolved assignments; method/count/assignment changes shall supersede pending results and invalidate PNG encoding, while returning to an applicable cached configuration shall restore identical output and switching to From photo shall restore that mode's result.
