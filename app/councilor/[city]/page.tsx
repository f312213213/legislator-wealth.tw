import { CouncilorSearchableList } from '@/components/councilor-searchable-list'
import { CouncilorCityNav } from '@/components/councilor-city-nav'
import { CurrencyDisplay } from '@/components/currency-display'
import { JsonLd } from '@/components/json-ld'
import {
  getCouncilorDeclarationBySlug,
  getCouncilorMetaSource,
  lookupStockPrice,
} from '@/lib/data'
import {
  getCouncilorCityName,
} from '@/lib/councilor-routes'
import {
  buildCouncilorRows,
  getCouncilorCityStaticParams,
  getCouncilorPartyStats,
  type CouncilorListItem,
} from '@/lib/councilor-analytics'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
/* eslint-disable @next/next/no-img-element */

export async function generateStaticParams() {
  return getCouncilorCityStaticParams()
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: citySlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  if (!cityName) return { title: citySlug }

  return {
    title: `${cityName}議員財產申報 — 地方議員持股排行`,
    description: `${cityName}議員名單、財產申報持股市值排行、黨籍整理與個別議員持股資料。`,
    alternates: {
      canonical: `/councilor/${citySlug}/`,
    },
    openGraph: {
      title: `${cityName}議員財產申報`,
      description: `${cityName}議員財產申報持股資料與市值排行。`,
      url: `/councilor/${citySlug}/`,
    },
  }
}

const PARTY_BAR: Record<string, string> = {
  '中國國民黨': 'bar-kmt',
  '民主進步黨': 'bar-dpp',
  '台灣民眾黨': 'bar-tpp',
  '無黨籍': 'bar-ind',
}

function buildTopHoldings(rows: CouncilorListItem[]) {
  const holdings = new Map<string, {
    name: string
    holderNames: Set<string>
    total: number
  }>()

  for (const row of rows) {
    const declaration = getCouncilorDeclarationBySlug(row.slug)
    if (!declaration) continue

    for (const stock of declaration.securities.stocks.items) {
      const price = lookupStockPrice(stock.name, 'stock')
      const value = price ? Math.round(stock.shares * price.price) : stock.ntdTotal
      const existing = holdings.get(stock.name) ?? { name: stock.name, holderNames: new Set<string>(), total: 0 }
      existing.holderNames.add(row.name)
      existing.total += value
      holdings.set(stock.name, existing)
    }

    for (const fund of declaration.securities.funds.items) {
      const price = lookupStockPrice(fund.name, 'fund')
      const value = price ? Math.round(fund.units * price.price) : fund.ntdTotal
      const existing = holdings.get(fund.name) ?? { name: fund.name, holderNames: new Set<string>(), total: 0 }
      existing.holderNames.add(row.name)
      existing.total += value
      holdings.set(fund.name, existing)
    }
  }

  return Array.from(holdings.values())
    .map(holding => ({
      name: holding.name,
      holderCount: holding.holderNames.size,
      holders: Array.from(holding.holderNames).sort((a, b) => a.localeCompare(b, 'zh-TW')),
      total: holding.total,
    }))
    .sort((a, b) => b.holderCount - a.holderCount || b.total - a.total)
    .slice(0, 8)
}

export default async function CouncilorCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  const rows = cityName ? buildCouncilorRows(citySlug) : []

  if (!cityName) {
    notFound()
  }

  const source = getCouncilorMetaSource()
  const ranked = rows.filter(row => row.hasDeclaration).sort((a, b) => b.amount - a.amount)
  const leader = ranked[0]
  const marketTotal = ranked.reduce((sum, row) => sum + row.amount, 0)
  const maxAmount = leader?.amount ?? 0
  const topHoldings = buildTopHoldings(rows)
  const partyStats = getCouncilorPartyStats(rows)

  return (
    <div className="space-y-10">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${cityName}議員財產申報`,
        description: `${cityName}議員名單、持股市值排行與個別財產申報資料。`,
        url: `https://legislator-wealth.tw/councilor/${citySlug}/`,
      }} />

      <header className="space-y-3 pt-4">
        <Link href="/councilor" className="text-sm text-muted-foreground underline hover:text-foreground">
          地方議員
        </Link>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{cityName}議會</p>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">{cityName}議員財產申報</h1>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          名單取自內政部地方公職人員資訊專區，申報 PDF 解析後會在此頁提供市值排行、黨籍整理、股票與基金統計。
        </p>
        {source.fetchedAt && (
          <p className="text-xs text-muted-foreground">
            名單來源：<a href={source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">內政部直轄市議員資料</a>
          </p>
        )}
        <CouncilorCityNav citySlug={citySlug} />
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="border p-3">
          <p className="text-xs text-muted-foreground">{cityName}議員</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{rows.length}</p>
        </div>
        <div className="border p-3">
          <p className="text-xs text-muted-foreground">已有申報資料</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{ranked.length}</p>
        </div>
        <div className="border p-3">
          <p className="text-xs text-muted-foreground">持股市值合計</p>
          <p className="mt-1 text-2xl font-black tabular-nums"><CurrencyDisplay amount={marketTotal} /></p>
        </div>
        <div className="border p-3">
          <p className="text-xs text-muted-foreground">黨籍分類</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{partyStats.length}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">持股市值排行</h2>
          <Link href={`/councilor/${citySlug}/rankings`} className="text-sm text-muted-foreground hover:text-foreground">
            完整排行
          </Link>
        </div>
        {leader ? (
          <div className="space-y-4">
            <Link href={leader.href} className="group block border-b pb-6">
              <p className="mb-3 text-sm text-muted-foreground">第 1 名</p>
              <div className="flex items-end gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-muted text-3xl font-black text-muted-foreground sm:h-28 sm:w-28">
                  {leader.avatar ? (
                    <img src={leader.avatar} alt={leader.name} className="h-full w-full object-cover" />
                  ) : (
                    leader.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-3xl font-black tracking-tight group-hover:underline sm:text-4xl">{leader.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{leader.party || '未標示黨籍'} · {leader.stockCount} 檔</p>
                  <p className="mt-2 text-2xl font-black tabular-nums tracking-tight"><CurrencyDisplay amount={leader.amount} /></p>
                </div>
              </div>
            </Link>

            {ranked.slice(1, 10).length > 0 && (
              <div className="divide-y">
                {ranked.slice(1, 10).map(row => {
                  const pct = maxAmount > 0 ? Math.max((row.amount / maxAmount) * 100, 2) : 0
                  const barClass = row.party ? (PARTY_BAR[row.party] || 'bg-foreground/10') : 'bg-foreground/10'
                  return (
                    <Link
                      key={row.slug}
                      href={row.href}
                      className="row-hover relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                    >
                      <div className={`absolute inset-y-0 left-0 ${barClass}`} style={{ width: `${pct}%` }} />
                      <span className="relative text-right text-lg font-black tabular-nums text-muted-foreground/25">#{row.rank}</span>
                      <div className="relative min-w-0">
                        <span className="font-bold">{row.name}</span>
                        <span className="ml-2 text-sm text-muted-foreground">{row.party || '未標示'}</span>
                      </div>
                      <span className="relative shrink-0 font-bold tabular-nums tracking-tight">
                        <CurrencyDisplay amount={row.amount} />
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="border-y py-8">
            <p className="text-sm text-muted-foreground">
              尚未建立持股排行榜。把{cityName}議員申報 PDF 放進 `raw-pdfs/councilors/` 並重新解析後，這裡會自動顯示排名。
            </p>
          </div>
        )}
      </section>

      {topHoldings.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">最多議員持有的股票／基金</h2>
            <Link href={`/councilor/${citySlug}/stocks`} className="text-sm text-muted-foreground hover:text-foreground">
              全部明細
            </Link>
          </div>
          <div className="divide-y border-y">
            {topHoldings.map((holding, index) => (
              <div key={holding.name} className="grid gap-2 px-3 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center">
                <span className="hidden text-right text-lg font-black tabular-nums text-muted-foreground/25 sm:block">#{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{holding.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{holding.holders.join('、')}</p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-bold tabular-nums">{holding.holderCount} 位</p>
                  <p className="text-xs text-muted-foreground"><CurrencyDisplay amount={holding.total} /></p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">依黨籍整理</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {partyStats.map(([party, stats]) => (
            <div key={party} className="border p-3">
              <p className="text-sm font-bold">{party}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stats.count} 位議員 · {stats.declarations} 份申報</p>
              <p className="mt-2 text-sm font-bold tabular-nums"><CurrencyDisplay amount={stats.total} /></p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">全部{cityName}議員</h2>
        <CouncilorSearchableList councilors={rows} />
      </section>
    </div>
  )
}
