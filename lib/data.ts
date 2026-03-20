import type { LegislatorDeclaration, ChangeDeclaration, LegislatorDocument, LegislatorIndex } from './types'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

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

export function lookupStockPrice(name: string): { code: string; price: number } | null {
  const prices = getStockPrices()
  const exact = prices.get(name)
  if (exact) return { code: exact.code, price: exact.closingPrice }
  // Try fuzzy: strip suffixes like ＊, *, -KY from input
  const cleaned = name.replace(/[＊*]/g, '').replace(/\s*-\s*KY.*$/, '').trim()
  if (cleaned !== name) {
    const found = prices.get(cleaned)
    if (found) return { code: found.code, price: found.closingPrice }
  }
  // Build reverse lookup: source names stripped of * too
  if (!_strippedCache) {
    _strippedCache = new Map()
    for (const [k, v] of prices) {
      const sk = k.replace(/[＊*]/g, '').replace(/\s*-\s*KY.*$/, '').trim()
      if (sk !== k && !_strippedCache.has(sk)) _strippedCache.set(sk, v)
    }
  }
  const fromStripped = _strippedCache.get(cleaned)
  if (fromStripped) return { code: fromStripped.code, price: fromStripped.closingPrice }
  return null
}

export function getIndex(): LegislatorIndex {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf-8')
  return JSON.parse(raw)
}

export function getDocument(filename: string): LegislatorDocument {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'legislators', filename), 'utf-8')
  return JSON.parse(raw)
}

export function getDeclaration(filename: string): LegislatorDeclaration {
  return getDocument(filename) as LegislatorDeclaration
}

export function getAllDeclarations(): LegislatorDeclaration[] {
  const index = getIndex()
  return index.legislators
    .filter(leg => leg.declarations.length > 0)
    .map(leg => getDeclaration(leg.declarations[0]))
}

export function getDeclarationByName(name: string): LegislatorDeclaration | null {
  const index = getIndex()
  const legislator = index.legislators.find(l => l.name === name)
  if (!legislator || legislator.declarations.length === 0) return null
  return getDeclaration(legislator.declarations[0])
}

export function getChangesByName(name: string): ChangeDeclaration[] {
  const index = getIndex()
  const legislator = index.legislators.find(l => l.name === name)
  if (!legislator || !legislator.changes || legislator.changes.length === 0) return []
  return legislator.changes.map(f => getDocument(f) as ChangeDeclaration)
}

export function getAllChanges(): ChangeDeclaration[] {
  const index = getIndex()
  return index.legislators.flatMap(leg =>
    (leg.changes || []).map(f => getDocument(f) as ChangeDeclaration)
  )
}

export type StockSource = 'stock' | 'fund'

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
      const priceInfo = lookupStockPrice(s.name)
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
      const priceInfo = lookupStockPrice(f.name)
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
