# Selected palettes: feature exploration

Status: proposal for discussion, not approved implementation intent. Research checked 2026-09-08. Existing inferred palettes and Full RGB remain available. No application behavior is changed by this exploration.

## Recommendation

Add two palette modes: **From photo** and **Choose palette**. Keep From photo as the default, with its existing Full RGB and arbitrary color-count controls. Choose palette uses a fixed, editable set of RGB colors; every logical pixel maps directly from its original scanner sample to the nearest enabled color. The chosen palette's active distinct colors determine capacity. Do not combine it with a second inferred-color-count control.

For the requested live scrolling/search experience, use Lospec's existing list and suggestion endpoints through a small, cacheable Vercel metadata endpoint, provided adding that server component is acceptable. All pixel processing and palette editing still run in the browser; only search terms and palette metadata pass through the endpoint. If hosting must remain fully static, use the searchable static catalog plus direct slug import instead. The existing Lospec list/search endpoints are usable but lack browser cross-origin access and are not documented as stable public APIs.

## Verified Lospec capabilities

The [documented API](https://lospec.com/palettes/api) provides individual palettes as JSON or CSV by slug. JSON includes name, author, and a hex-color array. For example, `https://lospec.com/palette-list/greyt-bit.json`. The documentation describes a 404 for a missing palette. It does not document a catalog/search endpoint or pagination contract.

A GET to that example endpoint with an Origin header returned HTTP 200 and `Access-Control-Allow-Origin: *`, supporting credential-free browser import for the tested request. This is an observation, not an availability guarantee. Request only palette data, never photo pixels. Use `credentials: omit`; do not rely on third-party cookies. The documented Open in Software feature uses an operating-system URI handler and is not needed for a normal web import flow.

Lospec's [palette website](https://lospec.com/palette-list) has name, color-count, and tag filters and several sort options. Website filters should not be presented as a supported public search API.

## Architecture options

### A. Static catalog plus direct imports — recommended

Serve a deliberately selected catalog of palette names, authors, source links, and color arrays with the app. Search and filtering happen locally. Load additional palettes through the documented per-slug endpoint when a user pastes a Lospec link or slug. Retain attribution on imported and bundled entries, and check redistribution conditions before selecting the bundled catalog.

Users can scroll cards, filter by color count, and search the app's known palette names/authors/tags. Catalog metadata is maintained explicitly; the single-palette API does not supply tags or popularity metrics. Favorites and imported palettes extend the user's personal library. Do not describe local results as the entire Lospec collection. Offer browsing on Lospec in another tab, followed by link import.

This keeps deployment static and lets shipped/saved palettes work without a live provider request. The tradeoff is catalog maintenance and incomplete in-app discovery. Lospec outages affect new imports, not current artwork. A JSON/hex file import provides a manual fallback. Cached palette data can survive reloads without persisting the user's photograph or drawing.

### B. Direct import plus Lospec website discovery

Use Lospec itself for all remote browsing/search, and keep only recent/favorite/imported palettes inside Paper Pixel. Users open the palette site, choose a palette, return, and paste its URL. File import supports palettes downloaded elsewhere. Mapping and editing remain identical to option A.

This has the smallest maintenance burden and uses only documented palette downloads. It avoids depending on an undocumented search interface or distributing a catalog. Its drawback is the phone experience: changing tabs, copying a URL, returning to the app, and importing interrupt visual comparison. An explanation and persistent local palette library reduce repeated friction, but do not deliver seamless in-app discovery. This is a useful minimum release or fallback if a starter catalog is undesirable. No app registration with an operating system is required. Keep the scan intact while users browse and return.

### C. Live Lospec search through a metadata endpoint — best fit for live discovery

Use the same GET routes as Lospec's website, through a small same-origin Vercel function. This avoids sending browser requests to endpoints that do not allow cross-origin reads. The function forwards only validated name/tag, color-count, sort, and page parameters to fixed Lospec routes, with bounded response size, caching, timeouts, and a normalized response schema. It is not an arbitrary URL proxy and never receives image pixels.

The list response already includes swatches, names, tags, author/submission information, and total count, so cards need no extra per-palette request. Name suggestions return titles and slugs; load a selected suggestion through the documented palette JSON API. Expose name search and tag/color filters as distinct operations, matching the actual provider behavior rather than assuming a combined full-text query. Cache pages and debounce queries, cancel superseded work, and preserve saved palettes/import when live browsing is unavailable.

This supplies live discovery without collecting a separate catalog, at the cost of a server component and dependence on undocumented route behavior. Keep Lospec integration in an adapter so response changes do not spread through the UI. A provider change can temporarily disable live browsing while direct import and local mapping remain usable. This option needs an explicit architecture decision because the current app is static, although the original browser-only image-processing requirement is fully preserved.

## Internal endpoint verification

The [palette-list page](https://lospec.com/palette-list/tag/8bit) loads [Lospec's palette-list JavaScript](https://cdn.lospec.com/static/javascripts/palette-list.js). Inspection identified:

- `GET /palette-list/load?colorNumberFilterType=any&colorNumber=8&page=0&tag=8bit&sortingType=default`.
- Observed count-filter values: `any`, `max`, `min`, `exact`; sort values: `default`, `alphabetical`, `downloads`, `newest`.
- List results contain `palettes` and `totalCount`; palette objects include `title`, `slug`, `colorsArray`, `numberOfColors`, `tags`, and user/creator metadata.
- Page 0 returned 10 of 12 matching palettes; page 1 returned the remaining 2 during this check. Pagination starts at zero.
- The name search field uses `GET /palette-list/suggest/{query}`. Testing `pico` returned title/slug pairs, including PICO-8. It is separate from list filters; combined search/filter semantics were not verified.

On 2026-09-08, real Chromium fetches from `https://paper-pixel-project.vercel.app` failed for both list pages and name suggestions. Their HTTP responses were 200 but had no `Access-Control-Allow-Origin`. The documented `greyt-bit.json` request succeeded from the same browser origin and returned `Access-Control-Allow-Origin: *`. Thus the internal routes are technically usable through a metadata server, but cannot currently be read directly by this frontend. `no-cors` would provide an unreadable opaque response and does not solve this.

## Mobile interaction

The artwork screen retains the pixel preview above a compact **From photo / Choose palette** switch. In selected mode, show the current palette name, active color count, a swatch strip, **Change palette**, and **Edit colors**. Keep export scale and download outside the picker.

**Change palette** opens a full-screen picker on narrow phones, with an explicit Back/Close control. Use a larger dialog or side panel on desktop. The picker has a search field, a compact filter control, and **Browse / Saved / Import** tabs. Display one palette card per row on phones: name, author, color count, and a swatch strip. Tap a card to preview it against the current drawing. Keep a compact artwork preview visible while browsing, with a sticky **Use palette** action. Do not calculate thumbnails for the entire catalog at once. Load or render additional rows in batches while preserving scroll position.

**Edit colors** opens a separate screen in the picker, rather than a nested stack of small dialogs. Each color has a large swatch target, a hex label, and an explicit enabled checkbox. Tapping the swatch opens a color editor with a native color input plus a hex field. Provide Add color, Undo, and Reset to imported palette. Use at least 44×44 CSS-pixel touch targets, visible focus, labels beyond color alone, safe-area-aware bottom actions, and a layout that remains usable with the keyboard open.

Edits update a draft preview. **Use palette** commits the draft atomically; Back/Cancel restores the previously applied palette and artwork. No confirmation dialog is needed merely to browse. Disable applying invalid hex text or a selection with fewer than two distinct colors. Proposed initial editor bound: 256 enabled distinct colors, independent of From photo's larger capacity range. Mark this limit clearly rather than truncating imports. Explain unused colors with a count such as “8 selected · 5 used.”

A saved edited palette is a personal copy. Preserve its original source/author attribution and mark it Edited; never imply changes are submitted to Lospec. Consider **Edit a copy** of the inferred palette as a convenient route from From photo into Choose palette without changing the existing automatic mode.

## Pixel mapping and cache behavior

Use the existing color-sensitive Oklab distance `ΔL² + 8Δa² + 8Δb²` initially so color matching is consistent across modes. Validate on several palette styles before treating it as a universal aesthetic optimum. Precompute palette Oklab values, then map each original sample to its nearest enabled representative. Break ties by stable palette order. Output must contain only exact selected RGB values; no centroid calculation, inferred fallback colors, dithering, or invented white. Do not use the inferred path's K≥U preservation shortcut for a selected palette.

All logical cells, including bare paper, participate. A palette without a paper-like color recolors the background too. Choosing very dark or bright pigments can cause pale sampled strokes to map to background. Preview exposes that tradeoff; automatic contrast correction, forced background assignment, dithering, and per-pixel recoloring are separate features.

Cache mapped results by drawing revision, matching algorithm version, and the normalized ordered active RGB list, not by palette name or color count. Preserve the current inferred cache and use a shared bounded LRU budget for reduced/mapped results. Full RGB remains separately available. Palette edits and enabled-color changes invalidate the relevant mapping; undoing to an earlier active set can hit the cache. Export scale does not affect mapping. Ignore cancelled or stale worker results during rapid browsing.

Keep imported/saved palette definitions separately from mapped image results. Saved palette definitions and favorites may persist locally; photo pixels, output pixels, and mapped-result caches remain session-only. Bound imports, validate hex data, preserve an existing valid palette on import failure, and offer retry/file import. Fetch only allowlisted Lospec slug URLs, not arbitrary user-entered addresses.

## Scope and implementation sequence

The current HLD explicitly excludes chosen palettes, and Artwork currently specifies read-only swatches and inferred colors only. Adopting this proposal requires revising those scoped statements and their EARS/tests before implementation, using the project's linked-intent workflow. Scanner sampling and worksheet geometry need no changes. Worksheet's network-locality test must distinguish permitted palette metadata downloads from prohibited image uploads.

Suggested order: decide static catalog versus live metadata endpoint; fixed-palette mapper and its invariants; source-mode state/cache; mobile selection and editing with draft/apply/cancel; direct Lospec/file import and attribution; searchable static catalog and saved definitions. Check rapid selection and cancellation, 3-color palettes, duplicate/disabled colors, invalid hex and empty selections, grayscale palettes, exact PNG color membership, preservation on import failure, 320px layout, keyboard use, and network requests containing no artwork.

## Exploratory examples

Two local images were generated from the existing 32×32 flower samples using nearest selected-color matching. They are experiments, not changes to the app:

- `test-results/palette-exploration/lospec-greyt-bit.png`: the eight colors downloaded from Lospec's Greyt-bit palette, author `skeddles`.
- `test-results/palette-exploration/custom-flower-example.png`: an illustrative editable three-color palette, `#F2EAD9`, `#BD4545`, `#398353`.

The Greyt-bit result drops many faint strokes because its nearest-color choices do not align with the photographed pigments. The custom example produces a cream/red/green treatment but also loses some pale detail. A chosen palette changes the representation, not merely the displayed swatches. These examples support making artwork preview central to palette discovery and editing.
