# Implementation Verification

## Automated Results

- `npm test`: 17 tests passed across layout/metadata, geometry/sampling, palettes/cache/export pixels, image-header limits, worker cancellation, and real marker detection fixtures.
- Cross-browser suite: 28 distinct checks passed across Chromium, Firefox, and WebKit. The complete run passed 27 checks and identified a WebKit late-camera mock incompatibility; after fixing only that test fixture, the late-camera check passed in all three engines. Two canvas-stream camera fixtures are deliberately skipped in Firefox/WebKit; the synthetic stream capture/cleanup integration runs in Chromium, and late-permission cleanup runs in all engines.
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

No physical print-and-camera trial was performed. Real iPhone/Android photographs, printer margins, pencil/marker texture, uneven lighting, lens distortion, and the initial 64×64 ceiling still require trials. The specified phone performance targets are not claimed as measured benchmarks. Browser-engine testing is not a substitute for physical Safari/Chrome camera behavior.

The app is configured for static Vercel deployment but has not been published to a Vercel project. No accounts, secrets, or server processing are needed. Deployment and local-use instructions are in [README.md](../README.md).
