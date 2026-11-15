# enstar-pipeline

A one-page static site explaining Enstar's proposed second natural gas line into Girdwood, Alaska, and HLB Resolution 2026-11 (gas easement on HLB Parcel 6-062).

Live at https://enstar-pipeline.nickcrews.workers.dev

## Layout

- `public/index.html`: the whole site (summary, timeline, FAQ, limitations, sources)
- `public/sources/`: copies of public government documents and meeting transcripts cited by the page
- `wrangler.jsonc`: Cloudflare Workers static-assets config

## Deploy

```sh
npm install
npx wrangler deploy
```
