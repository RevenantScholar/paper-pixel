# Preserving form when applying a palette

Status: exploration, not an implementation change. Evaluated 2026-09-08 with the user-provided flower photo, existing sampled RGB fixture, and [CherryMelon by WildLeoKnight](https://lospec.com/palette-list/cherrymelon). The palette's documented JSON endpoint returned `fcdeea`, `ff4d6d`, `265935`, `012824`.

## Finding

The user's exported 32×32 PNG uses pale pink for 965 cells, red for four, and green for 55. Nearest-color mapping of the existing full-resolution sampled fixture produces 966, five, and 53 respectively; browser image resizing accounts for small sampling differences. Pale red and green samples frequently map to the pale background instead of the much more saturated/darker target colors.

Current Choose palette mode starts from original scanner samples. Selecting a four-color inferred palette first does not make that inferred output the input to selected-palette mapping. The inferred size and the selected palette size currently control independent modes.

## Compared approaches

1. **Direct nearest-color mapping:** current implementation. It preserves exact target-palette membership but can lose distinctions visible in the source drawing.
2. **Distinct assignment of inferred groups:** infer source groups first, then minimize weighted color error while assigning each group a distinct target entry. For three groups and four CherryMelon colors this produces a useful result. For four source groups it fails aesthetically: two paper shades compete for separate targets, making one paper region green. Distinct target assignments are therefore not a universal preservation rule.
3. **Explicit group recoloring:** infer four source groups, then map both paper shades to pale pink, red to coral, and green to dark green. Every cell in a source group receives its assigned target color. This preserves the flower's inferred red and green shapes while deliberately merging paper shades. The mapping is manually selected for this demonstration, not a proven automatic contrast-preserving algorithm.

The four-group source contains two paper groups (379 and 505 cells), red (52), and green (88). The explicit mapping retains all 52 red and 88 green cells. No geometry, source sampling, or per-cell painting was changed.

## Proposed product direction

Treat palette application as recoloring an inspectable inferred drawing. Keep a Drawing colors control independent of the target palette's available colors. Display compact source-swatch → target-swatch rows with usage counts. Tapping a row opens large selectable target swatches; changes affect the whole source group with a live preview. Allow multiple source groups to intentionally share a target color, and never require every target color to appear.

Keep direct closest-color matching as an optional method. A suggested mapping can initialize the rows, but should be visibly editable. Automatic preservation requires choosing which source distinctions matter; neither global one-to-one matching nor nearest centroid alone guarantees that. Before selecting an automatic default, evaluate neutral paper groups, grayscale art, bright palettes, fewer target colors than source groups, and genuine low-contrast detail. An explicit mapping workflow can provide reliable user control without guessing those roles.

Group recoloring would need cache keys including source-group count and assignments, mode-aware output/PNG invalidation, and an updated Artwork HLD/LLD/EARS contract before implementation. Existing selected-palette editing/library behavior remains useful. Cell sampling still loses some sparse crayon detail; recoloring cannot recover marks absent from the logical source image.

## Local comparison artifacts

`test-results/cherrymelon-review/comparison.png` shows direct mapping on the left and explicit four-group recoloring on the right, using identical scanner samples. The same folder contains source inference, direct mapping, and distinct-group experiments. These are exploratory outputs, not changes shipped in the application.
