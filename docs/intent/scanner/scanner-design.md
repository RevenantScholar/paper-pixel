---
parent: high-level-design
prefix: SCANNER
---

# Scanner

## Context and Design Philosophy

The scanner converts a photograph of a flat worksheet into N × N representative RGB samples. Automatic registration provides an initial alignment that the user can inspect and correct. Grid dimensions, logical orientation, and cell geometry are explicit, so device rotation cannot silently rotate the artwork.

## Capture and State

States are empty, camera-starting, camera-ready, decoding, detecting, reviewing, sampling, and ready, with recoverable errors attached to the active operation. Show Choose Photo and Use Camera in the Scan view. Request the rear camera as a preference after a user gesture, with audio disabled. Display an unmirrored preview and a Capture button. Capture one frame at the video stream's actual dimensions; continuous live detection is outside the first release.

Permission denial, no camera, or unavailable secure-context camera access keeps photo selection available. Stop every acquired track after capture, camera cancellation, leaving Scan, or unmount. If a permission request resolves after cancellation, stop that late stream immediately. Retake returns to capture while preserving the previous result and palette cache until a replacement image decodes successfully. Cancelled or failed replacement retains the committed scan; successful decode commits the new photo and invalidates previous samples even if detection subsequently fails.

Accept JPEG, PNG, and WebP still images. Decode with browser orientation handling exactly once, normalize to an sRGB canvas, and composite transparency over white. Reject unsupported or undecodable images with a clear retry action. The provisional compressed-file limit is 20 MiB. Resize to at most 2560 pixels on the longer side for processing, preserving aspect ratio; release the full decoded image immediately afterward. Before decode, validate JPEG, PNG, or WebP header dimensions: allow at most 48,000,000 pixels total and 12,000 pixels per side, with positive integer dimensions. Reject malformed or unreadable headers before decode. Check decoded dimensions against the validated header, allowing an axis swap for orientation. Retain allocation-failure handling because even an allowed image may exceed available memory.

## Worker Protocol

Transfer normalized RGBA to a dedicated worker for registration and sampling. Requests carry a monotonically increasing image revision and request ID. Detection returns metadata status, marker observations, and candidate grid corners. Sampling accepts confirmed corners and N, and returns row-major RGB bytes, source revision, and quality diagnostics. Results are applied only when both IDs still match current state.

Retake, geometry edits, dimension edits, and cancellation invalidate outstanding requests. Terminate and recreate the worker to cancel synchronous work. Keep normalized source pixels available in the UI-owned image canvas so another request can be made after worker termination. Release replaced images, object URLs, and buffers. Show activity immediately and offer Cancel; a 15-second operation timeout terminates the worker with a retry action. Cancellation or timeout retains the decoded photo and any confirmed geometry and returns to review. Offer Retry and manual corner placement, and keep stale artwork non-exportable.

## Registration and Metadata

Run js-aruco2 on a detection copy limited to a 1600-pixel long edge, using ARUCO_MIP_36h12 and a conservative dictionary error threshold verified against the pinned implementation. Use jsQR to decode metadata from normalized source pixels. Remap all detected coordinates into the normalized source coordinate system. All geometry below uses that coordinate system, independent of CSS preview scaling.

Use the normalized recognition layout's 16 marker corners and detector corners in their canonical order to fit a projective transform from dimensionless recognition coordinates to image coordinates. Normalize point coordinates before the least-squares solve. Require one observation for each expected marker ID; duplicate IDs make automatic registration ambiguous. Check finite coefficients, a convex non-reflected grid, bounds inside the image, and marker reprojection root-mean-square error no greater than 1% of the shorter recovered grid edge. Retry detection on the normalized source if the smaller copy fails. Do not infer a missing marker from only the remaining ones in the first release.

Metadata is independently validated by Worksheet's parser. Automatic metadata acceptance also requires all decoded QR corners to lie within the projected expected QR region expanded by 0.015 drawing-side units on each side. If the QR cannot be associated with the registered sheet, require explicit grid-dimension confirmation. Registration uses one versioned normalized layout and does not require actual paper size, original paper choice, print scale, page edges, or margins. Uniform resizing and translation of the entire worksheet are absorbed by the projective transform. The grid and markers must preserve their relative geometry and remain visible and readable; clipping content or separately moving markers is not supported automatic registration.

Display decoded grid size before conversion. If unavailable, require explicit confirmation of scan dimensions; current Create settings may prefill the dimension but never count as confirmation. Valid metadata initializes the scan dimension and can be explicitly overridden in review. Changing N preserves alignment but invalidates samples. The Scan view has no paper-size input. A cropped or unreadable QR can be replaced by explicit dimension entry while the intact markers still provide alignment.

If automatic registration fails, let the user place the four actual drawing corners, labeled top-left, top-right, bottom-right, bottom-left in artwork orientation. Handles support pointer dragging and keyboard adjustment. Include a Rotate 90° action for correcting intended orientation. The review overlay draws the N × N grid over the photo. Invalid, crossed, reflected, degenerate, or out-of-image corners disable conversion with a specific correction hint. Never sample the whole photo as a substitute for a failed grid detection.

## Cell Sampling and Quality

Solve a projective transform from the logical square [0,N] × [0,N] to confirmed image corners. For each cell, project a 5 × 5 regular lattice of points spanning the central 50% of its width and height. Bilinearly sample source RGB at each point, then take the component-wise median of the 25 values and round to 8-bit channels. Excluding cell edges avoids printed lines and neighboring colors. Every cell contributes one logical color, irrespective of physical area or number of source pixels.

Before sampling, project all cell corners and calculate each convex cell's minimum perpendicular thickness: for each edge, take the greatest perpendicular distance of any cell vertex from its supporting line, then take the minimum across edges. Use the smallest thickness across all cells for quality checks. Reject numerically ill-conditioned projective solves before these checks. Below 4 source pixels per cell, block conversion and request a closer, higher-resolution photo. From 4 to below 8, display a small-cell warning and allow an explicit Continue. These are provisional engineering thresholds requiring trials; they do not certify sharpness or absence of glare. Singular transforms and any sampling footprint outside image bounds are errors, not clamped samples.

Uncolored cells are sampled as visible paper and participate in palette inference like other cells. Output is opaque. No automatic background removal or illumination correction is applied in the initial design; users can retake photographs in even lighting. This makes the handling of pale pigments and paper predictable, but visible white cells may consume a palette entry. Paper color receives no reserved palette entry.

Each sampling-geometry change, including rotation, advances a drawing revision independently of image revision. The resolution-warning acknowledgment belongs to that drawing revision and is reset by geometry or dimension changes. Palette and export-scale changes preserve the acknowledgment.

## Contracts and Ownership

`SampledDrawing` has `revision`, integer `gridSize`, and a `Uint8Array` of exactly 3 × N × N channel bytes in logical row-major order. It contains no marker or margin samples. Artwork receives this immutable logical input; it never receives the camera stream. Invalidated samples immediately mark the artwork preview stale and disable export until a new valid result is ready.

Application-owned workers survive Create/Scan view changes so pending processing can finish; leaving Scan stops live camera tracks and late camera requests only.

Scanner owns input decoding, camera lifecycle, normalized image dimensions, geometry review, and worker errors. Worksheet owns metadata parsing and normalized recognition geometry. Artwork owns all color quantization. No scanner threshold converts samples to black or white.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Detection runtime | Bundled js-aruco2 and jsQR | OpenCV WASM; browser-native barcode detector | Provides a browser implementation with explicit marker and QR support and avoids depending on uneven native API availability. |
| Perspective model | Planar projective transform | Axis-aligned crop; camera calibration and lens correction | Handles tilted flat sheets without asking users to calibrate cameras. |
| Paper independence | Register normalized layout coordinates | Read paper metadata or detect page edges | Recovers the drawing after whole-sheet resizing without needing the physical substrate dimensions. |
| Sampling | Median of central lattice samples | Single point; full-cell average | Reduces local texture while excluding border lines. |
| Background | Opaque sampled paper | Automatic white removal; transparency | Avoids silently removing pale drawn colors and keeps every logical cell represented. |
| Capture | User-triggered still frame | Continuous real-time scanning | Bounds work and provides a stable image for manual alignment. |

## Behavioral Requirements

The component's behavioral requirements are defined in [scanner-specs.md](scanner-specs.md), using the `SCANNER-*` namespace.

## Verification Design

Use independently constructed known grids under rotation and perspective to check cell ordering and sampling. Include real detector round trips, missing/duplicate markers, malformed metadata, geometry overrides, small-cell thresholds, and invalid quadrilaterals. Test cancellation and late camera/worker completion so stale work cannot replace current results. Test transparent imports and EXIF rotation. Verify the same drawing after whole-layout resizing, translation, A4-to-Letter fit-to-page printing, changed margins, and cropping away page edges, while retaining readable markers and grid. Run browser checks in Chromium, Firefox, and WebKit; physical targets are Safari on an iPhone and Chrome on an Android phone. Device availability and observed results must be recorded rather than inferred from browser emulation.

Provisional performance target: detection plus sampling within 5 seconds for a 32 × 32 image capped at 2560 pixels on representative phones, with cancellable processing throughout. This is an acceptance target to measure, not an existing benchmark.

## Open Questions & Future Decisions

- Decide whether physical trials justify stronger lighting normalization, marker thresholds, or sampling bounds.
- Validate the 48-megapixel and 12,000-pixel image-header bounds against ordinary phone photos.
- Curled sheets and severe lens distortion may require a richer model in a later version.

## References

- [High-level design](../../high-level-design.md)
- [Worksheet](../worksheet/worksheet-design.md)
- [Artwork](../artwork/artwork-design.md)
- [js-aruco2](https://github.com/damianofalcioni/js-aruco2)
- [jsQR](https://github.com/cozmo/jsQR)
- [Camera access](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

