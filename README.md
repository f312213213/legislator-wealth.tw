# Taiwan Legislator Stock Holdings

A transparency platform showing stock and fund holdings declared by Taiwan's 11th Legislative Yuan members.

Declaration data is sourced from the Control Yuan public official property declaration system. Market values are estimated using TWSE/TPEx closing prices.

**Live site: [legislator-wealth.tw](https://legislator-wealth.tw)**

## Data Sources

| Dataset | Source |
|---|---|
| Legislator property declarations | [Control Yuan Public Official Property Declaration Search](https://priso.cy.gov.tw/layout/baselist) |
| Source PDFs | Control Yuan declaration/gazette PDFs stored in `raw-pdfs/` |
| Current legislator names, parties, and photos | Legislative Yuan legislator list, fetched by `scripts/fetch-legislators.ts` |
| Listed and OTC stock prices | TWSE, TPEx, and ESB quote feeds, fetched by `scripts/fetch-stock-prices.ts` |

The Control Yuan declaration search is the canonical source for public official property declarations. This project parses the relevant declaration PDFs and only publishes derived stock/fund holdings and transaction records.

## Data Scope

- Stocks (Section 八.1)
- Fund certificates (Section 八.3)
- Stock transaction records from change declarations

Other asset categories (real estate, deposits, debts, etc.) are not included.

## Tech Stack

- **Next.js 16** — App Router, static export (`output: 'export'`)
- **shadcn/ui** — Base UI preset, `--radius: 0`
- **Tailwind CSS 4**
- **pdfjs-dist** — PDF text extraction
- **Cloudflare Pages** — static deployment

## Data Pipeline

```
Control Yuan PDF → parse-pdf.ts → JSON → build-index.ts → export-api.ts → Next.js SSG → static HTML + JSON API
```

| Script | Purpose |
|---|---|
| `scripts/fetch-stock-prices.ts` | Fetch latest prices from TWSE/TPEx/ESB |
| `scripts/fetch-legislators.ts` | Scrape legislator photos and party from ly.gov.tw |
| `scripts/parse-pdf.ts` | Parse gazette PDFs into structured JSON |
| `scripts/build-index.ts` | Build legislator index with pinyin URL slugs |
| `scripts/export-api.ts` | Export parsed and derived datasets as static JSON |
| `scripts/generate-og.ts` | Generate per-legislator Open Graph preview images |

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Place Control Yuan gazette PDFs in raw-pdfs/

# 3. Build static site and JSON API (runs the data pipeline)
pnpm run build

# 4. Preview static output locally
npx serve out

# 5. Preview Cloudflare Pages Functions locally
npx wrangler pages dev out
```

## Development

```bash
# Make sure you've run grab-data first (needs data/ and public/avatars/)
pnpm dev
```

## Updating Data

After adding new PDFs to `raw-pdfs/`:

```bash
pnpm run build        # Regenerate data/API files and rebuild the site
```

Stock prices are also updated daily at 22:00 UTC+8 via [GitHub Action](.github/workflows/fetch-stock-data.yml).

## Static JSON API

The build exports the parsed data as static JSON under `/api/`. Most endpoints are regular files served from the CDN; `/api/legislators` is a Cloudflare Pages Function that queries those generated files. Use `npx wrangler pages dev out` for local testing of the Function route; `npx serve out` only previews the static files.

On Cloudflare Pages, use `pnpm run build` as the build command and `out` as the build output directory. The build command runs `pnpm run grab-data` first, so clean Cloudflare builds regenerate `data/legislators/`, `data/index.json`, and `public/api/` from the committed PDFs. Static API files are served with public CORS headers from `public/_headers`, and the query endpoint sets its own CORS headers.

AI agents can discover API usage instructions at `/llms.txt`.

| Endpoint | Description |
|---|---|
| `/api/_meta.json` | API metadata and route list |
| `/api/docs.json` | Structured API documentation for programs and agents |
| `/api/llms.txt` | Agent-readable API usage guide |
| `/api/all.json` | Full data dump plus derived datasets |
| `/api/index.json` | Legislator index |
| `/api/legislators` | Queryable Cloudflare Pages Function for legislator lookups |
| `/api/legislators?name={name}` | Query legislators by Chinese name; returns declaration/change details for exact lookups |
| `/api/legislators?slug={slug}` | Query one legislator by pinyin slug |
| `/api/legislators?q={query}` | Search legislators by name, slug, party, organization, or title |
| `/api/legislators?party={party}` | Filter legislators by party name or slug (`kmt`, `dpp`, `tpp`, `ind`); results include `stockSummary` and `holdings` |
| `/api/legislators.json` | Legislator list with party/photo metadata, stock summaries, and holdings |
| `/api/legislators/{slug}.json` | One legislator with stock summary, holdings, latest declaration, and changes |
| `/api/documents.json` | All parsed declaration and change documents |
| `/api/declarations.json` | All declaration documents |
| `/api/latest-declarations.json` | Latest declaration per legislator |
| `/api/changes.json` | All raw change documents |
| `/api/changes-flat.json` | Flattened change feed |
| `/api/parties.json` | Party list and legislator counts |
| `/api/stocks/holdings.json` | Stock/fund holdings with price estimates |
| `/api/stocks/aggregated.json` | Holdings aggregated by security |
| `/api/stocks/prices.json` | Stock price lookup table |

Generate only the API files locally after data exists with:

```bash
pnpm run export-api
```

Examples:

```bash
curl 'https://legislator-wealth.tw/api/legislators?name=黃捷'
curl 'https://legislator-wealth.tw/api/legislators?q=民進黨'
curl 'https://legislator-wealth.tw/api/legislators?party=dpp&limit=20'
curl 'https://legislator-wealth.tw/api/legislators?slug=huang-jie&include=details'
```

`include=details` is limited to direct `name` or `slug` lookups with five or fewer matches. Broad queries return summaries only.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Run the data pipeline, then build the static site, API files, and OG images |
| `pnpm run grab-data` | Run all data fetching and processing |
| `pnpm run parse` | Parse PDFs, build index, and export API files |
| `pnpm run fetch-stock-prices` | Fetch latest stock prices only |
| `pnpm run fetch-legislators` | Fetch legislator photos and party only |
| `pnpm run generate-og` | Generate OG images only |
| `pnpm run export-api` | Export static JSON API files under `public/api/` |
| `pnpm run build-index` | Build index only |

## Known Limitations

- Some legislators have no public declarations yet and are not listed
- PDF text extraction may lose rare characters (e.g. `寳` in `陳秀寳`)
- Fund names may be truncated due to multi-line PDF layout
- ~10% of stocks have no live price (delisted or foreign)

## Contributing

Data is parsed automatically from gazette PDFs. If you find errors, please [open an issue](https://github.com/f312213213/legislator-wealth.tw/issues).

## License

MIT (source code only — see [LICENSE](LICENSE))
