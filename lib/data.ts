import type {
  LegislatorDeclaration,
  ChangeDeclaration,
  LegislatorDocument,
  LegislatorIndex,
  CouncilorIndex,
  CouncilorMeta,
  CouncilorMetaFile,
  DeclarationIndexEntry,
} from './types'
import {
  getCouncilorCitySlug,
  getCouncilorCitySlugFromOrganization,
  getCouncilorMemberSlug,
} from './councilor-routes'
import fs from 'fs'
import path from 'path'

export type StockSource = 'stock' | 'fund'

const DATA_DIR = path.join(process.cwd(), 'data')
const LEGISLATORS_DIR = path.join(DATA_DIR, 'legislators')
const COUNCILORS_DIR = path.join(DATA_DIR, 'councilors')
const COUNCILORS_INDEX_PATH = path.join(DATA_DIR, 'councilors-index.json')
const COUNCILORS_META_PATH = path.join(DATA_DIR, 'councilors-meta.json')

// Stock price lookup from TWSE daily data
interface StockPrice { code: string; name: string; closingPrice: number }
let _priceCache: Map<string, StockPrice> | null = null

function getStockPrices(): Map<string, StockPrice> {
  if (_priceCache) return _priceCache
  _priceCache = new Map()
  // TWSE listed stocks
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'STOCK_DAY_ALL.json'), 'utf-8')
    const entries: { Code: string; Name: string; ClosingPrice: string }[] = JSON.parse(raw)
    for (const e of entries) {
      const price = parseFloat(e.ClosingPrice)
      if (!price || isNaN(price)) continue
      _priceCache.set(e.Name, { code: e.Code, name: e.Name, closingPrice: price })
    }
  } catch { /* file may not exist */ }
  // TPEx (櫃買) stocks — fallback for names not found in TWSE
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'tpex_mainboard_quotes.json'), 'utf-8')
    const entries: { SecuritiesCompanyCode: string; CompanyName: string; Close: string }[] = JSON.parse(raw)
    for (const e of entries) {
      if (_priceCache.has(e.CompanyName)) continue
      const price = parseFloat(e.Close)
      if (!price || isNaN(price)) continue
      _priceCache.set(e.CompanyName, { code: e.SecuritiesCompanyCode, name: e.CompanyName, closingPrice: price })
    }
  } catch { /* file may not exist */ }
  // ESB (興櫃) stocks — fallback for names not found in TWSE or TPEx
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'tpex_esb_latest_statistics.json'), 'utf-8')
    const entries: { SecuritiesCompanyCode: string; CompanyName: string; LatestPrice: string }[] = JSON.parse(raw)
    for (const e of entries) {
      if (_priceCache.has(e.CompanyName)) continue
      const price = parseFloat(e.LatestPrice)
      if (!price || isNaN(price)) continue
      _priceCache.set(e.CompanyName, { code: e.SecuritiesCompanyCode, name: e.CompanyName, closingPrice: price })
    }
  } catch { /* file may not exist */ }
  return _priceCache
}

let _strippedCache: Map<string, StockPrice> | null = null
let _normalizedCache: Map<string, StockPrice> | null = null

function normalizeStockName(name: string): string {
  return name
    .replace(/[＊*]/g, '')
    .replace(/[－–—]/g, '-')
    .replace(/\s*-\s*K\s*Y.*$/i, '')
    .replace(/\s*-\s*KY.*$/i, '')
    .replace(/\s+/g, '')
    .trim()
}

function getNormalizedPriceCache(prices: Map<string, StockPrice>): Map<string, StockPrice> {
  if (_normalizedCache) return _normalizedCache
  _normalizedCache = new Map()
  for (const [name, price] of prices) {
    const normalized = normalizeStockName(name)
    if (normalized && !_normalizedCache.has(normalized)) {
      _normalizedCache.set(normalized, price)
    }
  }
  return _normalizedCache
}

function lookupExactOrNormalized(prices: Map<string, StockPrice>, name: string): StockPrice | null {
  const exact = prices.get(name)
  if (exact) return exact

  const normalized = normalizeStockName(name)
  return getNormalizedPriceCache(prices).get(normalized) ?? null
}

function hasUnlistedMarker(name: string): boolean {
  return /未上市|非上市|未上櫃|非上櫃|未公開發行|非公開發行/.test(name)
}

function stripDeclarationDecorations(name: string): string {
  return name
    .replace(/新臺幣總額或折合新臺幣/g, '')
    .replace(/[「『]?交付[^」』\s]*信託[」』]?/g, '')
    .replace(/^\s*(?:上市|上櫃|興櫃|公開發行)股票?\s*[/／]\s*/g, '')
    .trim()
}

function stockNameCandidates(name: string): string[] {
  const base = stripDeclarationDecorations(name)
  const candidates = [
    base,
    base.replace(/金融控股股份有限公司$/, '金'),
    base.replace(/工程$/, ''),
    base.replace(/輪胎$/, ''),
    base.replace(/海運$/, ''),
    base.replace(/航運$/, ''),
    base.replace(/證券$/, '證'),
    base.replace(/科技股份有限公司$/, ''),
    base.replace(/科技$/, ''),
    base.replace(/股份有限公司$/, ''),
    base.replace(/有限公司$/, ''),
  ]

  return [...new Set(candidates.map(s => s.trim()).filter(Boolean))]
}

function isMarketFund(price: StockPrice): boolean {
  return /^0/.test(price.code)
}

function findUniqueContainedFundName(prices: Map<string, StockPrice>, cleaned: string): StockPrice | null {
  if (cleaned.length < 3) return null

  const matches: { price: StockPrice; sourceName: string }[] = []
  for (const [name, price] of prices) {
    if (!isMarketFund(price)) continue
    const sourceName = normalizeStockName(name)
    if (sourceName.length < 4) continue
    if (!sourceName.includes(cleaned) && !cleaned.includes(sourceName)) continue
    matches.push({ price, sourceName })
  }

  matches.sort((a, b) => b.sourceName.length - a.sourceName.length)
  if (matches.length === 0) return null
  if (matches.length > 1 && matches[0].sourceName.length === matches[1].sourceName.length) return null
  return matches[0].price
}

export function lookupStockPrice(name: string, source: StockSource = 'stock'): { code: string; price: number } | null {
  if (hasUnlistedMarker(name)) return null

  const prices = getStockPrices()
  const exact = lookupExactOrNormalized(prices, name)
  if (exact && (source === 'stock' || isMarketFund(exact))) {
    return { code: exact.code, price: exact.closingPrice }
  }

  // Try fuzzy: strip suffixes like ＊, *, -KY from input
  const cleaned = normalizeStockName(name)
  // Build reverse lookup: source names stripped of * too
  if (!_strippedCache) {
    _strippedCache = new Map()
    for (const [k, v] of prices) {
      const sk = normalizeStockName(k)
      if (sk !== k && !_strippedCache.has(sk)) _strippedCache.set(sk, v)
    }
  }
  const fromStripped = _strippedCache.get(cleaned)
  if (fromStripped && (source === 'stock' || isMarketFund(fromStripped))) {
    return { code: fromStripped.code, price: fromStripped.closingPrice }
  }

  if (source === 'stock') {
    for (const candidate of stockNameCandidates(name)) {
      const found = lookupExactOrNormalized(prices, candidate)
      if (found) return { code: found.code, price: found.closingPrice }
    }
  } else {
    const contained = findUniqueContainedFundName(prices, normalizeStockName(stripDeclarationDecorations(name)))
    if (contained) return { code: contained.code, price: contained.closingPrice }
  }

  return null
}

export function getIndex(): LegislatorIndex {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf-8')
  return JSON.parse(raw)
}

export function getCouncilorIndex(): CouncilorIndex {
  try {
    const raw = fs.readFileSync(COUNCILORS_INDEX_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { councilors: [], lastUpdated: '' }
  }
}

let _councilorMetaCache: CouncilorMetaFile | null = null

function emptyCouncilorMetaFile(): CouncilorMetaFile {
  return {
    source: {
      title: '內政部地方公職人員資訊專區',
      url: 'https://www.moi.gov.tw/LocalOfficial.aspx?n=573&TYP=KND0001',
      fetchedAt: '',
      cities: [],
    },
    councilors: {},
  }
}

function getCouncilorMetaFile(): CouncilorMetaFile {
  if (_councilorMetaCache) return _councilorMetaCache
  try {
    const raw = fs.readFileSync(COUNCILORS_META_PATH, 'utf-8')
    _councilorMetaCache = JSON.parse(raw)
  } catch {
    return emptyCouncilorMetaFile()
  }
  return _councilorMetaCache!
}

export function getAllCouncilorMeta(): CouncilorMeta[] {
  return Object.values(getCouncilorMetaFile().councilors).sort((a, b) => {
    const byCity = a.city.localeCompare(b.city, 'zh-TW')
    if (byCity !== 0) return byCity
    const titleRank = (title: string) => {
      if (title === '議長') return 0
      if (title === '副議長') return 1
      if (title.includes('代理')) return 2
      return 3
    }
    const byTitle = titleRank(a.title) - titleRank(b.title)
    if (byTitle !== 0) return byTitle
    return a.name.localeCompare(b.name, 'zh-TW')
  })
}

export function getCouncilorMetaBySlug(slug: string): CouncilorMeta | null {
  return getCouncilorMetaFile().councilors[slug] ?? null
}

export function getCouncilorMetaByCity(citySlug: string): CouncilorMeta[] {
  return getAllCouncilorMeta().filter(meta => getCouncilorCitySlug(meta.city) === citySlug)
}

export function getCouncilorIndexEntryBySlug(slug: string): DeclarationIndexEntry | null {
  return getCouncilorIndex().councilors.find(councilor => councilor.slug === slug) ?? null
}

export function getCouncilorIndexByCity(citySlug: string): DeclarationIndexEntry[] {
  return getCouncilorIndex().councilors.filter(councilor =>
    getCouncilorCitySlugFromOrganization(councilor.organization) === citySlug
  )
}

export function getCouncilorMetaByCityAndMemberSlug(citySlug: string, memberSlug: string): CouncilorMeta | null {
  return getAllCouncilorMeta().find(meta =>
    getCouncilorCitySlug(meta.city) === citySlug &&
    (meta.slug === memberSlug || getCouncilorMemberSlug(meta.slug, citySlug) === memberSlug)
  ) ?? null
}

export function getCouncilorIndexEntryByCityAndMemberSlug(
  citySlug: string,
  memberSlug: string
): DeclarationIndexEntry | null {
  return getCouncilorIndex().councilors.find(councilor =>
    getCouncilorCitySlugFromOrganization(councilor.organization) === citySlug &&
    (councilor.slug === memberSlug || getCouncilorMemberSlug(councilor.slug, citySlug) === memberSlug)
  ) ?? null
}

export function getCouncilorSlugByCityAndMemberSlug(citySlug: string, memberSlug: string): string {
  const meta = getCouncilorMetaByCityAndMemberSlug(citySlug, memberSlug)
  if (meta) return meta.slug

  const entry = getCouncilorIndexEntryByCityAndMemberSlug(citySlug, memberSlug)
  if (entry) return entry.slug

  return memberSlug.startsWith(`${citySlug}-`) ? memberSlug : `${citySlug}-${memberSlug}`
}

export function getCouncilorMeta(name: string, organization?: string): CouncilorMeta | null {
  return getAllCouncilorMeta().find(meta =>
    meta.name === name && (!organization || meta.organization === organization)
  ) ?? null
}

export function getCouncilorMetaSource(): CouncilorMetaFile['source'] {
  return getCouncilorMetaFile().source
}

export function getLatestDeclarationDate(): string {
  const index = getIndex()
  return index.legislators.reduce((latest, leg) => {
    if (!leg.latestDeclarationDate) return latest
    return leg.latestDeclarationDate > latest ? leg.latestDeclarationDate : latest
  }, '')
}

export function getDocument(filename: string): LegislatorDocument {
  const raw = fs.readFileSync(path.join(LEGISLATORS_DIR, filename), 'utf-8')
  return JSON.parse(raw)
}

export function getCouncilorDocument(filename: string): LegislatorDocument {
  const raw = fs.readFileSync(path.join(COUNCILORS_DIR, filename), 'utf-8')
  return JSON.parse(raw)
}

export function getDeclaration(filename: string): LegislatorDeclaration {
  return getDocument(filename) as LegislatorDeclaration
}

export function getCouncilorDeclaration(filename: string): LegislatorDeclaration {
  return getCouncilorDocument(filename) as LegislatorDeclaration
}

export function getAllDeclarations(): LegislatorDeclaration[] {
  const index = getIndex()
  return index.legislators
    .filter(leg => leg.declarations.length > 0)
    .map(leg => getDeclaration(leg.declarations[0]))
}

export function getAllCouncilorDeclarations(): LegislatorDeclaration[] {
  const index = getCouncilorIndex()
  return index.councilors
    .filter(councilor => councilor.declarations.length > 0)
    .map(councilor => getCouncilorDeclaration(councilor.declarations[0]))
}

export function getDeclarationByName(name: string): LegislatorDeclaration | null {
  const index = getIndex()
  const legislator = index.legislators.find(l => l.name === name)
  if (!legislator || legislator.declarations.length === 0) return null
  return getDeclaration(legislator.declarations[0])
}

export function getDeclarationBySlug(slug: string): LegislatorDeclaration | null {
  const index = getIndex()
  const legislator = index.legislators.find(l => l.slug === slug)
  if (!legislator || legislator.declarations.length === 0) return null
  return getDeclaration(legislator.declarations[0])
}

export function getCouncilorDeclarationBySlug(slug: string): LegislatorDeclaration | null {
  const index = getCouncilorIndex()
  const councilor = index.councilors.find(c => c.slug === slug)
  if (!councilor || councilor.declarations.length === 0) return null
  return getCouncilorDeclaration(councilor.declarations[0])
}

export function getChangesBySlug(slug: string): ChangeDeclaration[] {
  const index = getIndex()
  const legislator = index.legislators.find(l => l.slug === slug)
  if (!legislator || !legislator.changes || legislator.changes.length === 0) return []
  return legislator.changes.map(f => getDocument(f) as ChangeDeclaration)
}

export function getCouncilorChangesBySlug(slug: string): ChangeDeclaration[] {
  const index = getCouncilorIndex()
  const councilor = index.councilors.find(c => c.slug === slug)
  if (!councilor || !councilor.changes || councilor.changes.length === 0) return []
  return councilor.changes.map(f => getCouncilorDocument(f) as ChangeDeclaration)
}

export function getChangesByName(name: string): ChangeDeclaration[] {
  const index = getIndex()
  const legislator = index.legislators.find(l => l.name === name)
  if (!legislator || !legislator.changes || legislator.changes.length === 0) return []
  return legislator.changes.map(f => getDocument(f) as ChangeDeclaration)
}

export function getSlugByName(name: string): string {
  const index = getIndex()
  const legislator = index.legislators.find(l => l.name === name)
  return legislator?.slug || encodeURIComponent(name)
}

export function getCouncilorSlugByName(name: string, organization?: string): string {
  const index = getCouncilorIndex()
  const councilor = index.councilors.find(c =>
    c.name === name && (!organization || c.organization === organization)
  )
  return councilor?.slug || encodeURIComponent(name)
}

export function getAllChanges(): ChangeDeclaration[] {
  const index = getIndex()
  return index.legislators.flatMap(leg =>
    (leg.changes || []).map(f => getDocument(f) as ChangeDeclaration)
  )
}

export function getAllCouncilorChanges(): ChangeDeclaration[] {
  const index = getCouncilorIndex()
  return index.councilors.flatMap(councilor =>
    (councilor.changes || []).map(f => getCouncilorDocument(f) as ChangeDeclaration)
  )
}

export interface StockHolding {
  name: string
  owner: string
  legislator: string
  shares: number
  parValue: number
  currency?: string
  ntdTotal: number
  source: StockSource
  stockCode?: string
  marketPrice?: number
  marketValue?: number
}

export function getAllStockHoldings(): StockHolding[] {
  const declarations = getAllDeclarations()
  const holdings: StockHolding[] = []

  for (const decl of declarations) {
    for (const s of decl.securities.stocks.items) {
      const priceInfo = lookupStockPrice(s.name, 'stock')
      holdings.push({
        name: s.name,
        owner: s.owner,
        legislator: decl.name,
        shares: s.shares,
        parValue: s.parValue,
        currency: s.currency,
        ntdTotal: s.ntdTotal,
        source: 'stock',
        stockCode: priceInfo?.code,
        marketPrice: priceInfo?.price,
        marketValue: priceInfo ? Math.round(s.shares * priceInfo.price) : undefined,
      })
    }
    for (const f of decl.securities.funds.items) {
      const priceInfo = lookupStockPrice(f.name, 'fund')
      holdings.push({
        name: f.name,
        owner: f.owner,
        legislator: decl.name,
        shares: f.units,
        parValue: f.nav,
        currency: f.currency,
        ntdTotal: f.ntdTotal,
        source: 'fund',
        stockCode: priceInfo?.code,
        marketPrice: priceInfo?.price,
        marketValue: priceInfo ? Math.round(f.units * priceInfo.price) : undefined,
      })
    }
  }

  return holdings
}

export interface AggregatedStock {
  name: string
  holders: { legislator: string; owner: string; shares: number; ntdTotal: number }[]
  totalShares: number
  totalNTD: number
  holderCount: number
}

export function getAggregatedStocks(): AggregatedStock[] {
  const holdings = getAllStockHoldings()
  const stockMap = new Map<string, AggregatedStock>()

  for (const h of holdings) {
    const existing = stockMap.get(h.name)
    const holder = {
      legislator: h.legislator,
      owner: h.owner,
      shares: h.shares,
      ntdTotal: h.ntdTotal,
    }
    if (existing) {
      existing.holders.push(holder)
      existing.totalShares += h.shares
      existing.totalNTD += h.ntdTotal
      existing.holderCount = new Set(existing.holders.map(x => x.legislator)).size
    } else {
      stockMap.set(h.name, {
        name: h.name,
        holders: [holder],
        totalShares: h.shares,
        totalNTD: h.ntdTotal,
        holderCount: 1,
      })
    }
  }

  return Array.from(stockMap.values()).sort((a, b) => b.holderCount - a.holderCount)
}

export interface LegislatorMeta {
  party: string
  avatar: string
}

let _metaCache: Record<string, LegislatorMeta> | null = null

function getLegislatorMetaMap(): Record<string, LegislatorMeta> {
  if (_metaCache) return _metaCache
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'legislators-meta.json'), 'utf-8')
    _metaCache = JSON.parse(raw)
  } catch {
    _metaCache = {}
  }
  return _metaCache!
}

export function getLegislatorMeta(name: string): LegislatorMeta | null {
  const map = getLegislatorMetaMap()
  return map[name] ?? null
}

export function getLegislatorsByParty(party: string): LegislatorDeclaration[] {
  const declarations = getAllDeclarations()
  return declarations.filter(d => {
    const meta = getLegislatorMeta(d.name)
    return meta?.party === party
  })
}

export function getAllParties(): string[] {
  const metaMap = getLegislatorMetaMap()
  const parties = new Set<string>()
  for (const v of Object.values(metaMap)) {
    if (v.party) parties.add(v.party)
  }
  return Array.from(parties)
}

export const PARTY_SLUG_MAP: Record<string, string> = {
  'kmt': '中國國民黨',
  'dpp': '民主進步黨',
  'tpp': '台灣民眾黨',
  'ind': '無黨籍',
}

export const PARTY_NAME_TO_SLUG: Record<string, string> = {
  '中國國民黨': 'kmt',
  '民主進步黨': 'dpp',
  '台灣民眾黨': 'tpp',
  '無黨籍': 'ind',
}

export function getStockPriceMap(): Record<string, { code: string; price: number }> {
  const prices = getStockPrices()
  const map: Record<string, { code: string; price: number }> = {}
  for (const [name, info] of prices) {
    map[name] = { code: info.code, price: info.closingPrice }
  }
  return map
}

export interface FlatChange {
  legislator: string
  category: 'stock'
  name: string
  owner: string
  changeDate: string
  changeReason: string
  amount: number
  detail?: string
  changePeriod: { from: string; to: string }
}

export function getAllFlatChanges(): FlatChange[] {
  const changes = getAllChanges()
  const flat: FlatChange[] = []

  for (const change of changes) {
    if (change.stocks) {
      for (const stock of change.stocks) {
        flat.push({
          legislator: change.name,
          category: 'stock',
          name: stock.name,
          owner: stock.owner,
          changeDate: stock.changeDate,
          changeReason: stock.changeReason,
          amount: stock.total,
          detail: `${new Intl.NumberFormat('zh-TW').format(stock.shares)} 股 / ${stock.broker}`,
          changePeriod: change.changePeriod,
        })
      }
    }
  }

  return flat.sort((a, b) => b.changeDate.localeCompare(a.changeDate))
}
