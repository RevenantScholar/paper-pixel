# Implementation Verification

## Automated Results

- `npm test`: 27 tests passed across layout/metadata, geometry/sampling, palettes/cache/export pixels, image-header limits, worker cancellation, and real marker detection fixtures.
- Cross-browser suite: 28 distinct checks passed across Chromium, Firefox, and WebKit. The complete palette-fix verification run passed all 28 enabled checks. Two canvas-stream camera fixtures are deliberately skipped in Firefox/WebKit; the synthetic stream capture/cleanup integration runs in Chromium, and late-permission cleanup runs in all engines.
- `npm run build`: TypeScript compilation and the Vite production build passed.
- `npm run check:intent`: all 83 behavioral requirements have test and implementation references; no unknown spec references.
- Dependency installation after updating Sharp to 0.35.4 reported zero known vulnerabilities.

Browser checks cover printable layout at desktop and 320/375-pixel mobile widths, single-page Chromium PDF output, actual generated ArUco/QR recognition, PNG export dimensions and palette color counts, cache comparisons and navigation, camera denial and late cleanup, encoder failure and stale exports, JPEG EXIF orientation, WebP imports, and no external image-processing requests.

Synthetic marker tests recover exact logical orientation and known colors at 0°, 90°, 180°, and 270° after rescaling. Missing-marker fixtures require manual recovery. Geometry tests exercise independent projective point correspondences and reject narrow or degenerate cells. Screenshots of the desktop worksheet, mobile worksheet, and completed scan were visually inspected during verification.

## Semantic Coherence

| Design pair | Result |
|---|---|
| Worksheet requirements → worksheet design → high-level design | Consistent: 32×32 default, 2–64 range, large square layout, and normalized paper-independent registration geometry. |
| Scanner requirements → scanner design → high-level design | Consistent: local capture and workers, explicit geometry/drawing revisions, manual recovery, and one RGB sample per logical cell. |
| Artwork requirements → artwork design → high-level design | Consistent: image-derived palette capacity, bounded local result caching, original-sample preservation, and integer PNG replication. |
| Approved interaction audit → implementation | Consistent: cancelled replacement retains committed work, geometry edits invalidate derived artwork, navigation preserves worker state, and sampling warnings are revision-scoped. |

## Practical Validation Still Needed

A user-provided photograph of a printed 32×32 red/green crayon drawing was evaluated through marker detection, sampling, and palette reduction. Broader physical trials across iPhone/Android cameras, printers, lighting, lens distortion, and the initial 64×64 ceiling remain necessary. The specified phone performance targets are not claimed as measured benchmarks. Browser-engine testing is not a substitute for physical Safari/Chrome camera behavior.

The app is configured for static Vercel deployment but has not been published to a Vercel project. No accounts, secrets, or server processing are needed. Deployment and local-use instructions are in [README.md](../README.md).

## Textured Drawing Palette Regression

The quantizer uses color-sensitive distance ΔL² + 8Δa² + 8Δb² for initialization, refinement, and final assignment. It infers centroids without a saturation transform or illumination correction. The sampled crayon fixture verifies separate red/green representatives and maps the 5×5 lower-left blank-paper patch to the same color as brighter paper when capacity is three. The corner regression failed under the previous axis weights and passes with the current metric. This is a measured fixture result, not a guarantee of shadow removal under arbitrary lighting.

A 32×32 sampled RGB fixture isolates palette regressions from photo decoding and marker recognition. Tests cover three-, four-, and sixteen-color output, source immutability, deterministic results, exact Full RGB restoration, and neutral grayscale palettes. All 21 unit/integration tests, the production build, and intent-link checks pass. Artwork requirements and design use the same metric at all quantizer stages and remain consistent with the high-level image-derived palette architecture.

Nine targeted production-build browser checks pass across Chromium, Firefox, and WebKit: actual marker scanning and scaled PNG export, custom three-color export and 3→5→3 cached restoration, and palette cache preservation across navigation. A separate local Chromium check processes the user-provided full photo and decodes the downloaded three-color PNG; all 25 lower-left blank cells match the paper representative. The original photo remains outside the committed test fixtures.

Central-cell median sampling still suppresses sparse crayon marks when paper dominates the sampled points. Palette matching does not recover those missing strokes or normalize photographed paper illumination.

## Selected Palettes and Local Library

The selected-palette feature adds exact mapping to enabled RGB colors, direct Lospec URL/slug import, and 24 static palettes (six each at 2, 4, 16, and 256 entries). The catalog is a 2026-09-08 download-sorted snapshot with provenance in `src/data/README.md`. No live search endpoint or server is required. Public palette metadata is downloaded only when Load palette is selected; images stay in the browser.

Unit checks cover canonical URLs, rejected external hosts, malformed/oversized responses, validated colors and enabled sets, exact mapping without the inference bypass, distinct cache identities, bounded persisted definitions, valid edited-copy restoration, corrupt/blocked storage, and all 24 bundled records. All 27 unit/integration tests pass. Build and intent checks pass with 91 linked requirements.

The full development-browser run passed 34 checks, skipped the two existing unsupported camera fixtures, and exposed a test-only selector mismatch for the new size filter. After changing that selector to its accessible combobox role, all three mobile catalog checks pass. New cancellation/timeout checks pass in Chromium, Firefox, and WebKit. The selected workflows verify PNG colors belong to the selected set, undo restores cached mapping, incomplete edits disable export and preserve the last valid saved copy, refresh defaults to From photo while retaining palettes, failed imports preserve output, and late responses cannot replace newer edits. Mobile catalog/editor checks include 320px overflow assertions and screenshot inspection.

Semantic review: selected-mode exact mapping is separate from inferred-mode centroids and K≥U preservation. Both start from immutable scanner samples. Mode/palette changes invalidate PNG encoding and worker work; cache identities include mode and full active RGB values. Palette definitions persist separately from session-only image results. The HLD, Artwork design, EARS, and implementation agree on the frontend-only import approach and resource bounds.

Final production-build verification passed all nine selected-palette browser checks across Chromium, Firefox, and WebKit after adding the editor preview. The 320px screenshot includes the bundled picker, remembered palette selector, source link, editable swatches, and adjacent live preview with no horizontal overflow.


## Group Recoloring

Recolor groups is the selected-palette default. Source inference and selected output have independent bounded caches. Explicit mappings reference original palette entries, follow hex edits, and remain invalid when an assigned entry is disabled or missing. Source changes clear mapping contexts; count and method switches preserve applicable mappings. All image-derived state remains session-only.

All 30 unit/integration tests pass. The crayon fixture verifies Cherrymelon suggestions map both paper groups to pink and retain each red and green group’s cell membership. Build and intent checks pass with 96 linked requirements. The full browser run passed 40 checks and skipped two unsupported camera fixtures; the three new checks initially stopped at a test selector mismatch. After correcting the selector, all 12 selected-palette production checks pass in Chromium, Firefox, and WebKit. A subsequent visual swatch fix passed all three group regressions again against the final production build.

The group browser regression covers default/fallback count, four→three→four cached restoration, switching to Closest colors and back, explicit assignments following target edits, disabled-target export blocking and recovery, invalid count handling, reset, and 320px layout. Screenshot review and geometry assertions verify target buttons are at least 44px and their visible swatches are at least 26px. Suggested mappings remain editable and do not guarantee preservation of details absent from the sampled source.
