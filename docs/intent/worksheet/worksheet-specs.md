# Worksheet Requirements

Design: [Worksheet](worksheet-design.md). Unchecked requirements are active implementation gaps.

## Configuration

- [x] **WORKSHEET-001**: When a fresh application session starts, the Create view shall initialize the grid to 32 × 32 and the paper to US Letter.
- [x] **WORKSHEET-002**: The Create view shall provide a grid-dimension input accepting every integer from 2 through 64, quick choices 8, 16, 32, and 64, a paper selector, a page preview, and a Print button.
- [x] **WORKSHEET-003**: If the Create grid dimension is empty, nonnumeric, fractional, or outside 2 through 64, then the application shall show an inline error and disable printing without rounding or clamping the entry.
- [x] **WORKSHEET-004**: While a valid Create grid dimension exceeds 32, the application shall display a reminder that smaller cells require a clear photograph.
- [x] **WORKSHEET-005**: The worksheet generator shall support portrait A4 at 210 × 297 mm and portrait Letter at 215.9 × 279.4 mm independently of palette capacity and export scale.

## Layout and Printing

- [x] **WORKSHEET-006**: When generating a worksheet for paper width W and height H in millimeters, the generator shall center a square drawing area of side min(W−16, H−52) and divide it into N × N equal square cells without changing its physical bounds as N changes.
- [x] **WORKSHEET-007**: The worksheet generator shall render physical SVG output with neutral light-gray 0.15 mm interior grid lines and a 0.3 mm outer border whose widths do not depend on N.
- [x] **WORKSHEET-008**: When generating a version-1 worksheet, the generator shall use normalized drawing bounds [0,1] × [0,1], marker side 0.06, at least 0.01 surrounding white quiet space, and marker top-left positions (0,−0.075), (0.94,−0.075), (0.94,1.015), and (0,1.015), scaling the whole recognition layout by the physical drawing side.
- [x] **WORKSHEET-009**: The version-1 worksheet generator shall use canonical-rotation ARUCO_MIP_36h12 marker IDs 0, 1, 2, and 3 for logical top-left, top-right, bottom-right, and bottom-left respectively, using the scanner's dictionary definition.
- [x] **WORKSHEET-010**: The worksheet generator shall place the QR including its quiet zone at normalized bounds (0.45,−0.115) through (0.55,−0.015), scaling with the drawing, and place a visible dimension label and print instructions below the drawing without overlapping marker quiet areas.
- [x] **WORKSHEET-011**: If worksheet elements extend outside the selected paper or overlap reserved quiet regions, then the generator shall report a layout error and prevent printing.
- [x] **WORKSHEET-012**: When the user prints a valid worksheet, the application shall invoke browser printing with a single selected-size sheet, zero CSS page margins, and hidden application chrome, and shall present instructions to retain the complete readable drawing, markers, quiet areas, and QR using actual-size or fit-to-page printing with browser headers and footers disabled.

## Metadata and Application Shell

- [x] **WORKSHEET-013**: The version-1 QR generator shall encode exactly `PXSCAN:1:<N>` using canonical decimal N, error correction M, and a four-module quiet zone, without including paper, palette, or export settings.
- [x] **WORKSHEET-014**: When parsing worksheet metadata, the parser shall accept only the complete supported payload grammar of at most 64 characters with grid dimension 2 through 64 and shall return version and dimension as validated structured data without requiring paper size.
- [x] **WORKSHEET-015**: If worksheet metadata is absent, unrecognized, malformed, out of bounds, or names an unsupported version, then the parser shall return a structured failure distinguishing absent/unrecognized data, invalid values, and unsupported versions without treating an unsupported version as version 1.
- [x] **WORKSHEET-016**: The shared recognition layout shall expose normalized drawing bounds, marker IDs and canonical corners, and QR bounds independent of paper choice and grid dimension; print rendering shall translate and scale this layout onto the chosen page, and registration shall consume the normalized layout without physical page bounds.
- [x] **WORKSHEET-017**: When the user changes Create settings or prints another worksheet, the application shall preserve the loaded scan's independent dimensions, geometry, and artwork.
- [x] **WORKSHEET-018**: When navigating between Create and Scan, the application shall preserve current in-memory work; when reloading the application, it shall start a fresh session.
- [x] **WORKSHEET-019**: The application shall build as a Vercel-hostable static Vite frontend with bundled processing assets and shall process photographs and artwork locally without uploading them.
- [x] **WORKSHEET-020**: The application shell shall provide labeled keyboard-operable controls, visible focus, associated validation messages, and responsive views without horizontal page scrolling at viewport widths of 320 CSS pixels or greater.

- [x] **WORKSHEET-021**: The application header shall provide an accessible GitHub repository link to `https://github.com/RevenantScholar/paper-pixel` in both views, visible at supported mobile widths, opening in a new tab with `rel="noopener noreferrer"`, and hidden during printing.
