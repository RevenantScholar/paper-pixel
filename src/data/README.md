# Bundled Lospec palettes

`palettes.json` is a snapshot fetched 2026-09-08 from Lospec's public website filtering endpoint. For each N in 2, 4, 16, 256, the first six results of the following request were retained in returned order:

`https://lospec.com/palette-list/load?colorNumberFilterType=exact&colorNumber=N&page=0&tag=&sortingType=downloads`

Each record retains the title, source slug, creator/submitter attribution, original `colorsArray`, advertised size, and download-count snapshot. Source pages are `https://lospec.com/palette-list/<slug>`. The app renders its own swatch cards from color data; Lospec descriptions and example artwork are not bundled. Built-in filtering/search are entirely local. These internal endpoints are not used at runtime; additional imports use the documented `https://lospec.com/palette-list/<slug>.json` API.

The lists are dated selections, not continuously updated rankings. Some 256-entry palettes contain duplicate RGB entries; the original order is retained, while mapping deduplicates the enabled set and reports distinct active/output counts.
