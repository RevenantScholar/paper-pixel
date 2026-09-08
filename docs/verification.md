# Implementation Verification

## Automated Results

- `npm test`: 21 tests passed across layout/metadata, geometry/sampling, palettes/cache/export pixels, image-header limits, worker cancellation, and real marker detection fixtures.
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
