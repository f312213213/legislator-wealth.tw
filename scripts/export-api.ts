import fs from 'fs'
import path from 'path'
import {
  PARTY_NAME_TO_SLUG,
  getAggregatedStocks,
  getAllChanges,
  getAllDeclarations,
  getAllFlatChanges,
  getAllParties,
  getAllStockHoldings,
  getChangesBySlug,
  getDeclarationBySlug,
  getDocument,
  getIndex,
  getLegislatorMeta,
  getStockPriceMap,
} from '../lib/data'
import type { LegislatorDeclaration, LegislatorDocument } from '../lib/types'

const SITE_URL = 'https://legislator-wealth.tw'
const DATA_DIR = path.join(process.cwd(), 'data')
const INDEX_PATH = path.join(DATA_DIR, 'index.json')
const LEGISLATORS_DIR = path.join(DATA_DIR, 'legislators')
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const API_DIR = path.join(PUBLIC_DIR, 'api')

function safeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
}

function writeJson(relativePath: string, data: unknown) {
  const outputPath = path.join(API_DIR, relativePath)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

function writeText(relativePath: string, data: string) {
  const outputPath = path.join(API_DIR, relativePath)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, data.endsWith('\n') ? data : `${data}\n`, 'utf-8')
}

function loadDocuments(): LegislatorDocument[] {
  const index = getIndex()
  return index.legislators.flatMap(leg =>
    [...leg.declarations, ...(leg.changes || [])].map(file => getDocument(file))
  )
}

function stripLegislatorFromHolding(holding: ReturnType<typeof getAllStockHoldings>[number]) {
  return {
    name: holding.name,
    owner: holding.owner,
    shares: holding.shares,
    parValue: holding.parValue,
    currency: holding.currency,
    ntdTotal: holding.ntdTotal,
    source: holding.source,
    stockCode: holding.stockCode,
    marketPrice: holding.marketPrice,
    marketValue: holding.marketValue,
  }
}

function summarizeHoldings(holdings: ReturnType<typeof getAllStockHoldings>) {
  return {
    holdingCount: holdings.length,
    stockCount: holdings.filter(h => h.source === 'stock').length,
    fundCount: holdings.filter(h => h.source === 'fund').length,
    declaredValueTotal: holdings.reduce((sum, h) => sum + h.ntdTotal, 0),
    estimatedMarketValueTotal: holdings.reduce(
      (sum, h) => sum + (h.marketValue ?? h.ntdTotal),
      0
    ),
    pricedHoldingCount: holdings.filter(h => h.marketValue !== undefined).length,
  }
}

function buildApiDocs(routes: string[], generatedAt: string, dataLastUpdated: string) {
  return {
    apiVersion: 1,
    title: 'Taiwan Legislator Wealth API',
    baseUrl: SITE_URL,
    generatedAt,
    dataLastUpdated,
    discovery: {
      apiMetadata: '/api/_meta.json',
      apiDocs: '/api/docs.json',
      apiLlms: '/api/llms.txt',
      siteLlms: '/llms.txt',
    },
    routes,
    endpoints: [
      {
        path: '/api/legislators',
        type: 'Cloudflare Pages Function',
        description: 'Queryable legislator endpoint. Results include stockSummary and holdings.',
        queryParameters: {
          name: 'Chinese legislator name. Repeated params and comma-separated values are supported.',
          legislator: 'Alias for name.',
          slug: 'Pinyin slug. Repeated params and comma-separated values are supported.',
          party: 'Party name or slug. Slugs: kmt, dpp, tpp, ind.',
          q: 'Free-text search across name, slug, party, organization, and title.',
          search: 'Alias for q.',
          limit: 'Maximum records to return. Max 200.',
          offset: 'Pagination offset.',
          include: 'Use include=details for latestDeclaration and changes. Only direct name/slug lookups with <= 5 matches are allowed.',
        },
        examples: [
          '/api/legislators?name=黃捷',
          '/api/legislators?slug=huang-jie',
          '/api/legislators?q=民進黨&limit=10',
          '/api/legislators?party=dpp&limit=20',
          '/api/legislators?name=黃捷&include=details',
        ],
      },
      {
        path: '/api/legislators.json',
        type: 'static JSON',
        description: 'All legislators with metadata, counts, stockSummary, and holdings.',
      },
      {
        path: '/api/legislators/{slug}.json',
        type: 'static JSON',
        description: 'One legislator with stockSummary, holdings, latestDeclaration, and changes.',
      },
      {
        path: '/api/stocks/holdings.json',
        type: 'static JSON',
        description: 'All stock/fund holdings with price estimates.',
      },
      {
        path: '/api/stocks/aggregated.json',
        type: 'static JSON',
        description: 'Holdings aggregated by security.',
      },
      {
        path: '/api/changes-flat.json',
        type: 'static JSON',
        description: 'Flattened stock transaction/change feed.',
      },
      {
        path: '/api/all.json',
        type: 'static JSON',
        description: 'Full data dump.',
      },
    ],
    partySlugs: {
      kmt: '中國國民黨',
      dpp: '民主進步黨',
      tpp: '台灣民眾黨',
      ind: '無黨籍',
    },
    responseFields: {
      stockSummary: {
        holdingCount: 'Total number of stock/fund holdings.',
        stockCount: 'Number of stock holdings.',
        fundCount: 'Number of fund holdings.',
        declaredValueTotal: 'Sum of declaration values in NTD.',
        estimatedMarketValueTotal: 'Sum of marketValue when priced, otherwise ntdTotal.',
        pricedHoldingCount: 'Number of holdings with marketValue.',
      },
      holding: {
        name: 'Security or fund name.',
        owner: 'Declared owner.',
        shares: 'Share/unit count.',
        parValue: 'Par value for stocks or NAV for funds.',
        currency: 'Currency when present in source data.',
        ntdTotal: 'Declared value in NTD.',
        source: 'stock or fund.',
        stockCode: 'Matched Taiwan market code when available.',
        marketPrice: 'Matched market price when available.',
        marketValue: 'Estimated market value when available.',
      },
    },
    notes: [
      'Data is generated from public PDFs and may contain parser errors from source formatting or PDF text extraction.',
      'Some legislators may not appear if no public declaration record was available when the site was built.',
      'Market values are estimates and should not be treated as investment, legal, or financial advice.',
      'API responses are public and CORS-enabled.',
    ],
  }
}

function buildApiLlmsText(): string {
  return `# legislator-wealth.tw API

Taiwan legislator stock and fund holdings API. Data covers the 11th Legislative Yuan and is parsed from Control Yuan Gazette PDFs. Market values are estimates based on TWSE/TPEx closing prices when available.

Base URL: ${SITE_URL}
API metadata: ${SITE_URL}/api/_meta.json
API docs: ${SITE_URL}/api/docs.json

## Best Starting Points

- GET /api/legislators?name={name} - look up one or more legislators by Chinese name. Results include stockSummary and holdings. Direct lookups include latestDeclaration and changes when five or fewer records match.
- GET /api/legislators?slug={slug} - look up one legislator by pinyin slug.
- GET /api/legislators?q={query} - search by name, slug, party, organization, or title.
- GET /api/legislators?party={party} - filter by party. Supported party slugs: kmt, dpp, tpp, ind. Results include each legislator's stockSummary and holdings.
- GET /api/stocks/holdings.json - all stock/fund holdings with price estimates.
- GET /api/stocks/aggregated.json - holdings aggregated by security.
- GET /api/changes-flat.json - flattened stock transaction/change feed.
- GET /api/all.json - full data dump.

## Query Examples

\`\`\`bash
curl '${SITE_URL}/api/legislators?name=黃捷'
curl '${SITE_URL}/api/legislators?slug=huang-jie'
curl '${SITE_URL}/api/legislators?q=民進黨&limit=10'
curl '${SITE_URL}/api/legislators?party=dpp&limit=20'
curl '${SITE_URL}/api/legislators?name=黃捷&include=details'
curl '${SITE_URL}/api/stocks/aggregated.json'
\`\`\`

## Stock Fields

Every /api/legislators result includes stockSummary and holdings.

- stockSummary.holdingCount: total stock/fund holdings.
- stockSummary.stockCount: stock holdings count.
- stockSummary.fundCount: fund holdings count.
- stockSummary.declaredValueTotal: sum of declared NTD values.
- stockSummary.estimatedMarketValueTotal: sum of estimated market values when available.
- holdings[].name: security or fund name.
- holdings[].source: stock or fund.
- holdings[].shares: shares or fund units.
- holdings[].ntdTotal: declared NTD value.
- holdings[].stockCode: matched Taiwan market code when available.
- holdings[].marketPrice: matched market price when available.
- holdings[].marketValue: estimated market value when available.

## Static JSON Endpoints

- /api/docs.json - structured API documentation.
- /api/llms.txt - this agent-readable API guide.
- /api/_meta.json - API version, generatedAt, dataLastUpdated, and route list.
- /api/index.json - raw legislator index.
- /api/legislators.json - all legislators with metadata, counts, stockSummary, and holdings.
- /api/legislators/{slug}.json - one legislator, stockSummary, holdings, latest declaration, and changes.
- /api/documents.json - all parsed declaration and change documents.
- /api/declarations.json - all declaration documents.
- /api/latest-declarations.json - latest declaration per legislator.
- /api/changes.json - all raw change documents.
- /api/changes-flat.json - flattened change feed.
- /api/parties.json - party list, counts, and legislators.
- /api/stocks/holdings.json - stock/fund holdings with price estimates.
- /api/stocks/aggregated.json - securities aggregated by holder count.
- /api/stocks/prices.json - stock price lookup table.
`
}

function main() {
  if (!API_DIR.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    throw new Error(`Refusing to write API outside public/: ${API_DIR}`)
  }

  if (!fs.existsSync(INDEX_PATH) || !fs.existsSync(LEGISLATORS_DIR)) {
    throw new Error('Missing generated data. Run `pnpm run grab-data` or `pnpm run parse` before exporting the API.')
  }

  fs.rmSync(API_DIR, { recursive: true, force: true })
  fs.mkdirSync(API_DIR, { recursive: true })

  const generatedAt = new Date().toISOString()
  const index = getIndex()
  const documents = loadDocuments()
  const declarations = documents.filter(
    (doc): doc is LegislatorDeclaration => doc.type === 'declaration'
  )
  const changes = getAllChanges()
  const latestDeclarations = getAllDeclarations()
  const flatChanges = getAllFlatChanges()
  const stockHoldings = getAllStockHoldings()
  const aggregatedStocks = getAggregatedStocks()
  const stockPrices = getStockPriceMap()
  const holdingsByLegislator = new Map<string, typeof stockHoldings>()

  for (const holding of stockHoldings) {
    const holdings = holdingsByLegislator.get(holding.legislator) || []
    holdings.push(holding)
    holdingsByLegislator.set(holding.legislator, holdings)
  }

  const legislators = index.legislators.map(leg => {
    const holdings = holdingsByLegislator.get(leg.name) || []
    return {
      ...leg,
      meta: getLegislatorMeta(leg.name),
      latestDeclaration: leg.declarations[0] || null,
      declarationCount: leg.declarations.length,
      changeCount: leg.changes?.length || 0,
      stockSummary: summarizeHoldings(holdings),
      holdings: holdings.map(stripLegislatorFromHolding),
    }
  })

  const parties = getAllParties().map(name => ({
    name,
    slug: PARTY_NAME_TO_SLUG[name] || encodeURIComponent(name),
    legislatorCount: legislators.filter(leg => leg.meta?.party === name).length,
    legislators: legislators
      .filter(leg => leg.meta?.party === name)
      .map(leg => ({ name: leg.name, slug: leg.slug })),
  }))

  const routes = [
    '/api/_meta.json',
    '/api/docs.json',
    '/api/llms.txt',
    '/api/all.json',
    '/api/index.json',
    '/api/legislators',
    '/api/legislators?name={name}',
    '/api/legislators?slug={slug}',
    '/api/legislators?q={query}',
    '/api/legislators?party={party}',
    '/api/legislators.json',
    '/api/legislators/{slug}.json',
    '/api/documents.json',
    '/api/declarations.json',
    '/api/latest-declarations.json',
    '/api/changes.json',
    '/api/changes-flat.json',
    '/api/parties.json',
    '/api/stocks/holdings.json',
    '/api/stocks/aggregated.json',
    '/api/stocks/prices.json',
  ]

  writeJson('_meta.json', {
    apiVersion: 1,
    generatedAt,
    dataLastUpdated: index.lastUpdated,
    siteUrl: SITE_URL,
    routes,
  })
  writeJson('docs.json', buildApiDocs(routes, generatedAt, index.lastUpdated))
  writeText('llms.txt', buildApiLlmsText())
  writeJson('index.json', index)
  writeJson('legislators.json', legislators)
  writeJson('documents.json', documents)
  writeJson('declarations.json', declarations)
  writeJson('latest-declarations.json', latestDeclarations)
  writeJson('changes.json', changes)
  writeJson('changes-flat.json', flatChanges)
  writeJson('parties.json', parties)
  writeJson('stocks/holdings.json', stockHoldings)
  writeJson('stocks/aggregated.json', aggregatedStocks)
  writeJson('stocks/prices.json', stockPrices)
  writeJson('all.json', {
    apiVersion: 1,
    generatedAt,
    dataLastUpdated: index.lastUpdated,
    index,
    legislators,
    documents,
    declarations,
    latestDeclarations,
    changes,
    flatChanges,
    parties,
    stockHoldings,
    aggregatedStocks,
    stockPrices,
  })

  for (const leg of index.legislators) {
    const slug = safeSlug(leg.slug)
    const holdings = holdingsByLegislator.get(leg.name) || []
    writeJson(`legislators/${slug}.json`, {
      ...leg,
      meta: getLegislatorMeta(leg.name),
      stockSummary: summarizeHoldings(holdings),
      holdings: holdings.map(stripLegislatorFromHolding),
      latestDeclaration: getDeclarationBySlug(leg.slug),
      changes: getChangesBySlug(leg.slug),
    })
  }

  console.log(`Exported static API to ${path.relative(process.cwd(), API_DIR)}`)
  console.log(`Routes: ${routes.join(', ')}`)
}

main()
