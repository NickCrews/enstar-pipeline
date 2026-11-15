# enstar-pipeline

A one-page static site explaining Enstar's proposed second natural gas line into Girdwood, Alaska, and HLB Resolution 2026-11 (gas easement on HLB Parcel 6-062).

Live at https://enstar-pipeline.nickcrews.workers.dev

## Layout

- `template.html`: the page (summary, timeline, FAQ, limitations); `build.py` fills in the numbered source list and writes `index.html`, the Vite entry
- `public/sources/`: copies of public government documents and meeting transcripts cited by the page
- `src/main.js`: the Leaflet map; elements with `data-map="view"` pick what it shows as you scroll
- `map_data.py`: builds `public/data/map.geojson` (parcels from github.com/NickCrews/anchorage-property, MOA streets and streams, approximate gas lines); run `npm run map` (needs `pip install duckdb shapely`)
- `wrangler.jsonc`: Cloudflare Workers static-assets config

## Develop and deploy

```sh
npm install
npm run dev      # regenerate index.html, serve at http://localhost:5173
npm run build    # regenerate index.html, build to dist/
npm run deploy   # build, then wrangler deploy to enstar-pipeline.nickcrews.workers.dev
```

Edit `template.html` for page content and `build.py` for the source list; `index.html` is generated.
