# Paper Pixel

A browser-only worksheet-to-pixel-art app, built with React, TypeScript, and Vite for static hosting on Vercel.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Camera access works on localhost or HTTPS. A phone visiting a plain HTTP LAN address can choose an existing photo, but browser camera access requires HTTPS.

## Use

1. Choose a square grid from 2×2 through 64×64 (default 32×32) and A4 or US Letter paper.
2. Print the worksheet or save it as a PDF from the print dialog. Keep the grid and corner markers clear and fully visible. Fit-to-page printing on another paper size is supported.
3. Color the cells, then choose a photo or capture one with the camera.
4. Check the detected grid, adjust the four handles if needed, and confirm dimensions if the QR could not be read. Convert to pixels.
5. Use **From photo** for Full RGB or an inferred color count. Use **Choose palette** for 24 bundled Lospec palettes (six each at 2, 4, 16, and 256 colors), or paste a Lospec palette URL/slug to load another. **Browse on Lospec** opens a new tab. **Recolor groups** first finds the drawing’s colors, then maps whole groups to palette colors. Adjust **Drawing colors** independently of the palette size and tap a mapping row to choose its target; several paper shades can share one background color. **Closest colors** is available for direct pixel matching. Open **Edit colors** to enable/disable colors, change swatches, add colors, undo, or reset.
6. Export at 1× for one PNG pixel per grid cell, or a larger integer scale for visibility. Output sides are limited to 4096 pixels.

Completed reduced palettes are cached in memory for fast visual comparison (up to 32 inferred results and 32 selected-palette results, each using least-recently-used eviction). Palette caches survive tab navigation and scale changes. A new drawing, changed sampling geometry, or page reload clears them. Photos and artwork are never uploaded. Up to 16 loaded palette definitions and their last valid color edits are remembered across refreshes in this browser; photographs and generated artwork are not saved. From photo remains the default on refresh. Bundled palettes work without runtime network requests; only importing additional palettes contacts Lospec.

## Deploy to Vercel

Import the repository into Vercel and choose the **Vite** framework preset. The included `vercel.json` sets:

- Build command: `npm run build`
- Output directory: `dist`

No environment variables, database, backend, or API keys are required. Vercel's HTTPS deployment supports browser camera permission prompts. Deployment itself is not performed by the local build.

## Verify

```sh
npm test
npx playwright install chromium firefox webkit
npm run test:e2e
npm run build
npm run check:intent
```

Unit tests cover layout, QR metadata, perspective correction, sampling, inferred colors, caching, resource limits, and worker cancellation. Browser tests exercise printed-marker detection, camera lifecycle, palette comparisons, printing styles, PNG downloads, and local processing. `check:intent` checks requirement references and test/code traceability; it does not replace runtime tests.

## Practical limits

- Input: JPEG, PNG, or still WebP, up to 20 MiB, 48 megapixels, and 12,000 pixels per side. Processing resizes the long edge to at most 2560 pixels.
- The 64×64 grid ceiling is an initial resource bound. Readability depends on marker clarity, cell size in the photograph, focus, lighting, and keeping the sheet flat.
- Photos of real printed sheets on representative iPhone and Android devices still require physical validation. Synthetic/browser tests do not establish camera accuracy under arbitrary lighting.
- Full RGB retains sampled color values, including lighting variation. No automatic paper removal or illumination correction is applied.
- No general-purpose painting editor, persistent artwork storage, or Yoto account integration is included.

Design and requirements are linked from [the high-level design](docs/high-level-design.md). The implementation follows the approved interaction audit in [docs/interaction-audit.md](docs/interaction-audit.md).

## Code layout

- `src/core/worksheet.ts`: normalized layout, printable SVG, and QR metadata.
- `src/core/detection.ts` and `geometry.ts`: marker registration, projective transforms, and cell sampling.
- `src/core/artwork.ts` and `usePalette.ts`: inferred palettes, local result cache, and scaled pixel output.
- `src/core/job.ts` and `processing.worker.ts`: cancellable browser processing.
- `src/App.tsx`: workflow state, camera lifecycle, scan review, and download controls.
