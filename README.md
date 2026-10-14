# Fun Hacks Radar

A static board of hackathons and creative open calls for Berna / 0xjitsu. Filter by lane, mode, and format. Switch between a card grid and a dense table. Sort by deadline, registration, prize, or name. Every row keeps an Apply link. Nothing on this site submits or registers for you.

Day and night themes follow the harvest-heat palette (soil, ember, rice-gold, new growth). The choice is stored in `localStorage` and, until you pick one, follows `prefers-color-scheme`.

## Preview locally

From this folder:

```bash
python3 -m http.server 8742
```

Open [http://127.0.0.1:8742](http://127.0.0.1:8742).

Any static server works (`npx serve .`). Opening `index.html` as a file will not load `data/opportunities.json`.

Cards are the default on small screens. The table is the default from about 1040px wide until you toggle a view; that choice is remembered.

## Deploy on Vercel (static)

The site is plain HTML, CSS, and JS. No build step and no environment variables.

1. Import the project in Vercel, or drag this folder onto [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Other**.
3. Build command: leave empty.
4. Output directory: the project root (`.`).
5. Deploy.

`vercel.json` turns on clean URLs and a few response headers. `data/opportunities.json` is fetched at runtime from the same origin.

## Data

`data/opportunities.json` is the enriched board (20 calls). Field notes, FX rules, and the per-item image log are in `ENRICHMENT.md`.

Each item keeps the original seed fields and adds `format`, `mode` (`online`, `hybrid`, or `irl`), `prizeLabel`, `prizeAmountUsd`, `prizeAmountNote`, `registrationOpens`, `registrationCloses`, `registrationLabel`, `image`, and `imageCredit`.

Prize dollars are a sort key only (KRW ÷ 1350, EUR × 1.1, PLN ÷ 4, token face value when stated). Null amounts sort last. Registration dates come only from text already in the seed.

## Images

Eighteen WebP thumbnails live in `assets/images/`. Two calls have `image: null` and render as a gradient with initials:

- **ryo-chan-2026** — the page is a JS shell with no usable OG image
- **ai-horizons-parma** — the listing is PDF-only

No remote image URL is left in the page.
