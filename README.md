# Taiwan Legislator Stock Holdings

A transparency platform showing stock and fund holdings declared by Taiwan's 11th Legislative Yuan members.

Data sourced from [Control Yuan Gazette](https://www.cy.gov.tw/). Market values estimated using TWSE/TPEx closing prices.

**Live site: [legislator-wealth.tw](https://legislator-wealth.tw)**

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
Control Yuan PDF → parse-pdf.ts → JSON → build-index.ts → Next.js SSG → static HTML
```

| Script | Purpose |
|---|---|
| `scripts/fetch-stock-prices.ts` | Fetch latest prices from TWSE/TPEx/ESB |
| `scripts/fetch-legislators.ts` | Scrape legislator photos and party from ly.gov.tw |
| `scripts/parse-pdf.ts` | Parse gazette PDFs into structured JSON |
| `scripts/build-index.ts` | Build legislator index with pinyin URL slugs |
| `scripts/generate-og.ts` | Generate per-legislator Open Graph preview images |

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Place Control Yuan gazette PDFs in raw-pdfs/

# 3. Fetch all data (stock prices + legislator meta + parse PDFs + build index)
pnpm run grab-data

# 4. Generate OG social preview images
pnpm run generate-og

# 5. Build static site
pnpm run build

# 6. Preview locally
npx serve out
```

## Development

```bash
# Make sure you've run grab-data first (needs data/ and public/avatars/)
pnpm dev
```

## Updating Data

After adding new PDFs to `raw-pdfs/`:

```bash
pnpm run grab-data    # Fetch prices + legislator meta + parse PDFs + build index
pnpm run build        # Rebuild (automatically generates OG images)
```

Stock prices are also updated daily at 22:00 UTC+8 via [GitHub Action](.github/workflows/fetch-stock-data.yml).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build static site (includes index + OG images) |
| `pnpm run grab-data` | Run all data fetching and processing |
| `pnpm run parse` | Parse PDFs and build index only |
| `pnpm run fetch-stock-prices` | Fetch latest stock prices only |
| `pnpm run fetch-legislators` | Fetch legislator photos and party only |
| `pnpm run generate-og` | Generate OG images only |
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
