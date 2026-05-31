import type { AggregatedStock, FlatChange, StockHolding } from './data'
import {
  getAllCouncilorMeta,
  getAllCouncilorChanges,
  getCouncilorDeclarationBySlug,
  getCouncilorIndex,
  getCouncilorIndexByCity,
  getCouncilorMetaByCity,
  lookupStockPrice,
} from './data'
import {
  getCouncilorCityName,
  getCouncilorCitySlug,
  getCouncilorCitySlugFromOrganization,
  getCouncilorPath,
} from './councilor-routes'
import { formatDate } from './format'
import type { DeclarationIndexEntry, LegislatorDeclaration } from './types'

export interface CouncilorListItem {
  name: string
  slug: string
  href: string
  city: string
  organization: string
  title: string
  party: string
  avatar: string
  amount: number
  stockCount: number
  hasDeclaration: boolean
  declarationDate: string
  rank: number | null
}

export function calcCouncilorMarketTotal(data: LegislatorDeclaration): number {
  let total = 0
  for (const s of data.securities.stocks.items) {
    const p = lookupStockPrice(s.name, 'stock')
    total += p ? Math.round(s.shares * p.price) : s.ntdTotal
  }
  for (const f of data.securities.funds.items) {
    const p = lookupStockPrice(f.name, 'fund')
    total += p ? Math.round(f.units * p.price) : f.ntdTotal
  }
  return total
}

export function getCouncilorCityStaticParams(): { city: string }[] {
  const citySlugs = new Set<string>()
  for (const meta of getAllCouncilorMeta()) {
    citySlugs.add(getCouncilorCitySlug(meta.city))
  }
  for (const councilor of getCouncilorIndex().councilors) {
    citySlugs.add(getCouncilorCitySlugFromOrganization(councilor.organization))
  }
  return Array.from(citySlugs).map(city => ({ city }))
}

export function buildCouncilorRows(citySlug: string): CouncilorListItem[] {
  const cityName = getCouncilorCityName(citySlug) ?? citySlug
  const metaBySlug = new Map(getCouncilorMetaByCity(citySlug).map(meta => [meta.slug, meta]))
  const indexBySlug = new Map(getCouncilorIndexByCity(citySlug).map(entry => [entry.slug, entry]))
  const slugs = new Set([...metaBySlug.keys(), ...indexBySlug.keys()])

  const rows = Array.from(slugs).map(slug => {
    const meta = metaBySlug.get(slug)
    const entry = indexBySlug.get(slug)
    const declaration = getCouncilorDeclarationBySlug(slug)
    const fallback = entry ?? {
      name: meta?.name ?? slug,
      slug,
      organization: meta?.organization ?? `${cityName}議會`,
      title: meta?.title ?? '議員',
    } satisfies Pick<DeclarationIndexEntry, 'name' | 'slug' | 'organization' | 'title'>
    const amount = declaration ? calcCouncilorMarketTotal(declaration) : 0

    return {
      name: meta?.name ?? declaration?.name ?? fallback.name,
      slug,
      href: getCouncilorPath(meta ?? fallback),
      city: meta?.city ?? cityName,
      organization: meta?.organization ?? declaration?.organization ?? fallback.organization,
      title: meta?.title ?? declaration?.title ?? fallback.title,
      party: meta?.party ?? '',
      avatar: meta?.avatar ?? '',
      amount,
      stockCount: declaration
        ? declaration.securities.stocks.items.length + declaration.securities.funds.items.length
        : 0,
      hasDeclaration: Boolean(declaration),
      declarationDate: declaration?.declarationDate ? formatDate(declaration.declarationDate) : '',
      rank: null,
    }
  })

  const ranks = new Map(
    rows
      .filter(row => row.hasDeclaration)
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'zh-TW'))
      .map((row, index) => [row.slug, index + 1])
  )

  return rows
    .map(row => ({ ...row, rank: ranks.get(row.slug) ?? null }))
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank
      if (a.rank) return -1
      if (b.rank) return 1
      return a.name.localeCompare(b.name, 'zh-TW')
    })
}

export function getCouncilorCitySummary(): Record<string, {
  name: string
  councilors: number
  declarations: number
  marketTotal: number
  parties: Set<string>
}> {
  const summary: Record<string, {
    name: string
    councilors: number
    declarations: number
    marketTotal: number
    parties: Set<string>
  }> = {}
  const citySlugsWithMeta = new Set<string>()

  for (const meta of getAllCouncilorMeta()) {
    const citySlug = getCouncilorCitySlug(meta.city)
    const cityName = getCouncilorCityName(citySlug) ?? meta.city
    citySlugsWithMeta.add(citySlug)
    summary[citySlug] ??= { name: cityName, councilors: 0, declarations: 0, marketTotal: 0, parties: new Set() }
    summary[citySlug].councilors++
    summary[citySlug].parties.add(meta.party || '未標示')
  }

  for (const indexEntry of getCouncilorIndex().councilors) {
    const citySlug = getCouncilorCitySlugFromOrganization(indexEntry.organization)
    const cityName = getCouncilorCityName(citySlug) ?? indexEntry.organization.replace(/議會$/g, '')
    summary[citySlug] ??= { name: cityName, councilors: 0, declarations: 0, marketTotal: 0, parties: new Set() }
    if (!citySlugsWithMeta.has(citySlug)) summary[citySlug].councilors++
    summary[citySlug].declarations += indexEntry.declarations.length > 0 ? 1 : 0
    const declaration = getCouncilorDeclarationBySlug(indexEntry.slug)
    if (declaration) summary[citySlug].marketTotal += calcCouncilorMarketTotal(declaration)
  }

  return summary
}

export function getCouncilorHoldings(citySlug?: string): StockHolding[] {
  const entries = citySlug ? getCouncilorIndexByCity(citySlug) : getCouncilorIndex().councilors
  const holdings: StockHolding[] = []

  for (const entry of entries) {
    const declaration = getCouncilorDeclarationBySlug(entry.slug)
    if (!declaration) continue

    for (const s of declaration.securities.stocks.items) {
      const priceInfo = lookupStockPrice(s.name, 'stock')
      holdings.push({
        name: s.name,
        owner: s.owner,
        legislator: declaration.name,
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

    for (const f of declaration.securities.funds.items) {
      const priceInfo = lookupStockPrice(f.name, 'fund')
      holdings.push({
        name: f.name,
        owner: f.owner,
        legislator: declaration.name,
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

export function getAggregatedCouncilorStocks(citySlug?: string): AggregatedStock[] {
  const stockMap = new Map<string, AggregatedStock>()

  for (const h of getCouncilorHoldings(citySlug)) {
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

export function getCouncilorHrefMap(citySlug?: string): Record<string, string> {
  const entries = citySlug ? getCouncilorIndexByCity(citySlug) : getCouncilorIndex().councilors
  const map: Record<string, string> = {}

  for (const entry of entries) {
    map[entry.name] = getCouncilorPath(entry)
  }

  if (citySlug) {
    for (const meta of getCouncilorMetaByCity(citySlug)) {
      map[meta.name] = getCouncilorPath(meta)
    }
  }

  return map
}

export function getCouncilorFlatChanges(citySlug?: string): FlatChange[] {
  const allowed = citySlug
    ? new Set(getCouncilorIndexByCity(citySlug).map(entry => entry.slug))
    : null
  const slugByKey = new Map(getCouncilorIndex().councilors.map(entry => [`${entry.organization}:${entry.name}`, entry.slug]))
  const flat: FlatChange[] = []

  for (const change of getAllCouncilorChanges()) {
    const slug = slugByKey.get(`${change.organization}:${change.name}`)
    if (allowed && (!slug || !allowed.has(slug))) continue

    for (const stock of change.stocks ?? []) {
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

  return flat.sort((a, b) => b.changeDate.localeCompare(a.changeDate))
}

export function getCouncilorPartyStats(rows: CouncilorListItem[]) {
  return Array.from(rows.reduce((map, row) => {
    const party = row.party || '未標示'
    const existing = map.get(party) ?? { count: 0, declarations: 0, total: 0 }
    existing.count++
    if (row.hasDeclaration) existing.declarations++
    existing.total += row.amount
    map.set(party, existing)
    return map
  }, new Map<string, { count: number; declarations: number; total: number }>()).entries())
    .sort((a, b) => b[1].total - a[1].total || b[1].count - a[1].count)
}

export function resolveCouncilorCity(citySlug: string) {
  const cityName = getCouncilorCityName(citySlug)
  if (!cityName) return null

  const rows = buildCouncilorRows(citySlug)
  if (rows.length === 0) return null

  return { cityName, rows }
}
