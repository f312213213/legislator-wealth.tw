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

function loadDocuments(): LegislatorDocument[] {
  const index = getIndex()
  return index.legislators.flatMap(leg =>
    [...leg.declarations, ...(leg.changes || [])].map(file => getDocument(file))
  )
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

  const legislators = index.legislators.map(leg => ({
    ...leg,
    meta: getLegislatorMeta(leg.name),
    latestDeclaration: leg.declarations[0] || null,
    declarationCount: leg.declarations.length,
    changeCount: leg.changes?.length || 0,
  }))

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
    writeJson(`legislators/${slug}.json`, {
      ...leg,
      meta: getLegislatorMeta(leg.name),
      latestDeclaration: getDeclarationBySlug(leg.slug),
      changes: getChangesBySlug(leg.slug),
    })
  }

  console.log(`Exported static API to ${path.relative(process.cwd(), API_DIR)}`)
  console.log(`Routes: ${routes.join(', ')}`)
}

main()
