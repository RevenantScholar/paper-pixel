---
parent: high-level-design
prefix: WORKSHEET
---

# Worksheet

## Context and Design Philosophy

The worksheet defines the physical drawing surface and the geometry the scanner uses to recover cells. A single versioned layout model produces print output and scanner coordinates. The drawing area stays the same physical size when the cell count changes.

## Configuration and Interface

The Create view contains a grid-dimension number input, paper selector, page preview, and Print button. Default to 32 × 32 and US Letter. Accept every integer N from 2 through a provisional development limit of 64, with quick choices 8, 16, 32, and 64. The limit is an initial engineering bound pending physical trials, not a claim that all phones reliably scan 64 × 64. Values above 32 display a small-cell reminder. Empty, fractional, nonnumeric, and out-of-range entries show inline errors and disable printing; do not silently round or clamp.

Use A4 (210 × 297 mm) and Letter (215.9 × 279.4 mm), portrait. Palette size is configured in the artwork view and is not a property required to print or scan the sheet.

## Page Geometry

Use a vector SVG with physical millimeter dimensions. Coordinates originate at the page's top-left. Reserve 8 mm page margins. Set the drawing side S = min(pageWidth − 16 mm, pageHeight − 52 mm), yielding 194 mm on A4 and 199.9 mm on Letter. Center the square on the page; let its top-left be (x, y). Each cell has side S/N. Grid lines are neutral light gray, 0.15 mm thick, with a 0.3 mm outer border. Physical line and marker sizes do not depend on N.

Define recognition geometry in dimensionless coordinates with the drawing square [0,1] × [0,1]. Marker side is 0.06, grid-to-marker gap is 0.015, and surrounding white quiet space is at least 0.01. Marker top-left positions are (0,−0.075), (0.94,−0.075), (0.94,1.015), and (0,1.015). The QR occupies (0.45,−0.115) through (0.55,−0.015), including its quiet zone. All lengths scale with drawing side S during printing. For example, a 200 mm drawing has 12 mm markers and a 3 mm grid-to-marker gap. Recognition geometry is identical across paper choices and grid dimensions.

Translate and scale the entire recognition layout into the centered physical drawing bounds. A brief dimension label and print instructions occupy the remaining bottom-band space without overlapping marker quiet areas. Geometry validation checks all element bounds and separations before rendering. Paper size determines placement on the printed page, not recognition geometry.

The print stylesheet selects the paper size, sets CSS page margins to zero, hides application chrome, and renders exactly one sheet. Present instructions to keep the full grid, markers, quiet areas, and QR visible and disable browser headers/footers. Actual size and fit-to-page printing on another paper size are both supported as long as the layout scales together and remains readable. The browser's print dialog also supports saving the sheet as PDF. Printer settings are outside application control.

## Marker and Metadata Format

Version 1 uses ARUCO_MIP_36h12, with IDs 0, 1, 2, 3 assigned respectively to logical top-left, top-right, bottom-right, and bottom-left. All markers are printed in canonical rotation. Generate the marker SVG using the same dictionary used by the scanner. The browser library is js-aruco2; its documentation covers SVG generation and browser detection. Verify the bundled version and corner-order convention in integration tests before use.

QR payload: `PXSCAN:1:<N>`, where N is a canonical decimal integer in the allowed range. Version 1 identifies the normalized recognition layout. Use QR error correction M and a four-module quiet zone. Generate module rectangles with the qrcode package's browser-compatible matrix API. The QR is metadata, not a navigable URL; it carries no paper size, palette size, or export scale.

The metadata parser accepts only this complete grammar, with a 64-character cap, supported version and valid N. Return a structured failure for absent/unrecognized data, unsupported version, and invalid values. Scanner offers explicit grid-dimension entry for an unreadable QR. An unsupported worksheet version is reported and cannot be automatically treated as version 1; manual grid-corner selection can still capture its drawing independently.

## Contracts and Ownership

`WorksheetConfig` contains print settings `version: 1`, `gridSize: integer`, and `paper: A4 | LETTER`. `WorksheetMetadata` contains only version and grid size. `RecognitionLayout` contains normalized drawing bounds, marker IDs and four canonical corners per marker, and QR bounds. `WorksheetLayout` places that recognition layout on the selected physical page; the scanner consumes only `RecognitionLayout` and `WorksheetMetadata`. Pure functions validate configuration, calculate layout, encode/decode metadata, and render vector content. They must not access camera state or mutate artwork.

The shared header provides a GitHub repository link to `https://github.com/RevenantScholar/paper-pixel`. It opens in a new tab to preserve the current drawing, remains accessible on mobile, and is hidden with application chrome when printing.

Worksheet owns the static application shell: Create and Scan navigation, responsive layout, shared accessible form components, and Vercel build configuration. The frontend is a single-page Vite application without path-based routes. Navigation changes views without losing current in-memory work. Refresh starts a fresh session. Camera and image-processing assets are bundled with the app and loaded locally from the deployment; there are no remote image-processing calls.

Worksheet configuration is distinct from a loaded scan's configuration. Printing a new grid cannot reinterpret an existing scan. Scanner owns explicit changes to the scan's dimensions or alignment.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Marker placement | Top and bottom bands aligned to square corners | Markers beside the grid or inside drawing cells | Bands preserve maximum drawing width and keep marks out of cell samples. |
| Printed format | Physical SVG and browser printing | Raster worksheet; dedicated PDF engine | Vectors preserve lines and marker modules across grid sizes with one layout model. |
| Sheet metadata | Versioned compact QR plus visible dimension | Device-local settings; infer N from drawn lines | Enables cross-device scanning and avoids relying on visible cell boundaries. |
| Scan geometry | One normalized layout for all paper sizes | Paper-dependent physical marker offsets | Makes shared sheets recognizable after fit-to-page printing without paper metadata. |
| Initial grid ceiling | Provisional 64 | Unlimited; fixed 16 | Bounds allocation while leaving room for trials to establish a supported limit. |

## Behavioral Requirements

The component's behavioral requirements are defined in [worksheet-specs.md](worksheet-specs.md), using the `WORKSHEET-*` namespace.

## Verification Design

Test minimum, maximum, and malformed dimensions; both paper sizes; unchanged drawing bounds across N; all marker/QR extents and quiet zones; metadata round trips and rejection. Render marker fixtures from the selected dictionary and round-trip them through scanner detection. Check printed PDFs for one-page output and complete geometry. Verify identical normalized marker/grid/QR coordinates for A4 and Letter and scanning of the same sheet rescaled onto different paper, with changed margins and page edges outside the photograph. Physical printer trials remain necessary before claiming reliable margins or maximum density.

## Open Questions & Future Decisions

- Validate the initial 64 ceiling and >32 reminder using photographed 16, 32, and 64 grids.
- Finalize print contrast and marker size after pencil, colored-pencil, and marker trials.

## References

- [High-level design](../../high-level-design.md)
- [Scanner](../scanner/scanner-design.md)
- [js-aruco2](https://github.com/damianofalcioni/js-aruco2)
- [qrcode](https://github.com/soldair/node-qrcode)
