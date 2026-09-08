# Scanner Requirements

Design: [Scanner](scanner-design.md). Unchecked requirements are active implementation gaps.

## Capture and Import

- [x] **SCANNER-001**: The Scan view shall provide Choose Photo and Use Camera actions; when the user chooses Use Camera, it shall request video with a rear-camera preference and audio disabled.
- [x] **SCANNER-002**: While the camera is ready, the Scan view shall display an unmirrored preview and Capture action; when Capture is selected, it shall capture one frame at the stream's actual dimensions.
- [x] **SCANNER-003**: If camera permission is denied, a camera is unavailable, or camera access is unsupported in the current context, then the Scan view shall explain the failure and keep Choose Photo available.
- [x] **SCANNER-004**: When capture completes, camera use is cancelled, the user leaves Scan, or its view unmounts, the scanner shall stop every acquired media track, including tracks returned by a permission request that resolves after cancellation.
- [x] **SCANNER-005**: When the user retakes or selects a replacement photo, the scanner shall retain the previous usable result until the replacement decodes successfully; if replacement import fails, it shall preserve that result and offer retry.
- [x] **SCANNER-006**: Before decoding an imported image, the scanner shall validate JPEG, PNG, or WebP format and header dimensions and permit only files at most 20 MiB with positive integer dimensions, at most 48,000,000 pixels, and at most 12,000 pixels per side.
- [x] **SCANNER-007**: If an image format, header, size, decode, decoded-dimension check, or allocation fails, then the scanner shall display a recoverable import error without replacing the current usable scan.
- [x] **SCANNER-008**: When normalizing an accepted photo, the scanner shall apply browser orientation once, allow a decoded width/height swap for orientation while checking header dimensions, composite transparency over white in sRGB, preserve aspect ratio, and limit the processing image's longest side to 2560 pixels without enlarging smaller images.

## Processing and Registration

- [x] **SCANNER-009**: The scanner shall run registration and sampling in a dedicated browser worker and shall apply results only when their image revision and request ID match the current requested operation.
- [x] **SCANNER-010**: When retaking, editing scan geometry or dimensions, or cancelling a scan operation, the scanner shall invalidate outstanding results and terminate and recreate the worker as needed to cancel synchronous processing.
- [x] **SCANNER-011**: While detection or sampling is running, the scanner shall show activity and Cancel; if the user cancels or the operation reaches 15 seconds, it shall terminate the operation, retain the decoded image and confirmed geometry, return to review, offer Retry or manual corners, and keep stale artwork non-exportable.
- [x] **SCANNER-012**: When replacing or releasing scan resources, the scanner shall release obsolete decoded images, object URLs, buffers, and workers while retaining normalized source pixels needed for a current retry.
- [x] **SCANNER-013**: When detecting version-1 registration markers, the scanner shall use ARUCO_MIP_36h12 on a copy at most 1600 pixels on its longest side, retry on the normalized source if that detection fails, and express all returned coordinates in normalized-source pixels.
- [x] **SCANNER-014**: When fitting automatic version-1 registration, the scanner shall require exactly one observation of each expected marker ID 0 through 3 and fit a normalized least-squares projective transform using all 16 canonical marker-corner correspondences from the dimensionless recognition layout without requiring paper size, print scale, margins, or page edges.
- [x] **SCANNER-015**: If automatic registration has missing or duplicate expected marker IDs, nonfinite or ill-conditioned coefficients, a reflected or nonconvex grid, out-of-image grid bounds, or marker reprojection RMS error greater than 1% of the shorter recovered grid edge, then the scanner shall reject automatic alignment and offer manual drawing-corner placement.
- [x] **SCANNER-016**: When decoding a worksheet QR, the scanner shall validate its payload with the worksheet parser and shall automatically accept it only when its four corners lie inside the registered normalized layout's expected QR region expanded by 0.015 drawing-side units per side and the association is unambiguous.
- [x] **SCANNER-017**: If worksheet metadata is missing, invalid, unsupported, or not unambiguously associated with the registered drawing, then the scanner shall require explicit confirmation of valid scan dimensions without requesting paper size; prefilled Create dimensions shall not count as confirmation, and unsupported worksheet versions shall require manual grid placement rather than version-1 registration assumptions.
- [x] **SCANNER-018**: When valid metadata initializes scan settings, the scanner shall display the decoded grid dimensions and allow explicit overrides before conversion without exposing a scan paper-size setting.
- [x] **SCANNER-019**: When the user changes a scan's grid dimension, the scanner shall preserve confirmed corners and invalidate samples; changes to Create paper settings shall not affect the loaded scan.

## Review and Sampling

- [x] **SCANNER-020**: The scan review shall show an N × N overlay with logical top-left, top-right, bottom-right, and bottom-left corner handles supporting pointer and keyboard adjustment and a Rotate 90° action that changes intended artwork orientation.
- [x] **SCANNER-021**: If manual scan corners are crossed, reflected, degenerate, or outside the normalized image, then the scanner shall disable conversion and display a correction hint without substituting the entire photograph for a valid grid.
- [x] **SCANNER-022**: Before sampling, the scanner shall solve the logical-square-to-image projective transform and reject nonfinite, singular, or ill-conditioned solutions and out-of-image sampling footprints without clamping invalid samples.
- [x] **SCANNER-023**: Before conversion, the scanner shall measure each projected cell's thickness as the minimum across its edges of the maximum vertex distance from that edge's supporting line and shall use the smallest cell thickness across the grid for resolution checks.
- [x] **SCANNER-024**: If the smallest projected cell thickness is below 4 source pixels, then the scanner shall block conversion and request a closer or higher-resolution photo; if it is at least 4 but below 8 pixels, then it shall require explicit Continue after a small-cell warning; if it is at least 8 pixels, then no small-cell confirmation shall be required.
- [x] **SCANNER-025**: When sampling a confirmed valid grid, the scanner shall bilinearly sample a 5 × 5 regular lattice spanning the central 50% of each logical cell, take component-wise medians, and round to 8-bit RGB to produce one color per cell in logical row-major order.
- [x] **SCANNER-026**: The scanner shall retain visible uncolored cells as sampled paper colors with no reserved palette color, background removal, illumination correction, or black/white thresholding.
- [x] **SCANNER-027**: When sampling succeeds, the scanner shall provide immutable source revision, grid dimension N, and exactly 3 × N × N RGB bytes to Artwork; when those samples are invalidated, it shall mark the artwork stale and disable export until current samples are ready.

- [x] **SCANNER-028**: When a supported worksheet is uniformly resized or translated as a complete layout onto different paper, the scanner shall recover the same logical grid and orientation without paper-size input, provided the grid and all four markers retain their relative geometry and satisfy visibility and resolution checks; an unreadable QR shall require dimension confirmation rather than paper identification.

- [x] **SCANNER-029**: When a retake is cancelled or replacement decoding fails, the scanner shall retain committed samples and palette caches; when replacement decoding succeeds, it shall invalidate them before new detection results arrive.
- [x] **SCANNER-030**: When sampling geometry, rotation, or grid dimensions change, the scanner shall advance a drawing revision independently of photo revision and clear any low-resolution acknowledgment; palette and export-scale changes shall preserve that acknowledgment.
- [x] **SCANNER-031**: When navigating away from Scan, the application shall preserve application-owned detection, sampling, and palette operations with their existing timeout and revision checks while stopping camera tracks and cancelling pending camera access.
