import { CouncilorCityNav } from '@/components/councilor-city-nav'
import { CurrencyDisplay } from '@/components/currency-display'
import { JsonLd } from '@/components/json-ld'
import { PartyBarChart, type StockBarData } from '@/components/party-bar-chart'
import { StockTable } from '@/components/stock-table'
import { getCouncilorCityName } from '@/lib/councilor-routes'
import {
  buildCouncilorRows,
  getAggregatedCouncilorStocks,
  getCouncilorCityStaticParams,
  getCouncilorHoldings,
  getCouncilorHrefMap,
} from '@/lib/councilor-analytics'
import { lookupStockPrice } from '@/lib/data'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  return getCouncilorCityStaticParams()
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: citySlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  return {
    title: cityName ? `${cityName}議員持股總覽` : '地方議員持股總覽',
    description: cityName ? `${cityName}議員申報的股票與基金持有明細。` : '地方議員申報的股票與基金持有明細。',
  }
}

export default async function CouncilorStocksPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  if (!cityName) notFound()

  const rows = buildCouncilorRows(citySlug)
  if (rows.length === 0) notFound()

  const holdings = getCouncilorHoldings(citySlug)
  const aggregatedStocks = getAggregatedCouncilorStocks(citySlug)
  const hrefMap = getCouncilorHrefMap(citySlug)
  const withHoldings = rows.filter(row => row.stockCount > 0)

  const personTotals = new Map(rows.map(row => [row.name, row.amount || 1]))
  const allStocksWithDetails = aggregatedStocks.map(stock => {
    const price = lookupStockPrice(stock.name, 'stock') ?? lookupStockPrice(stock.name, 'fund')
    const uniqueHolders = new Map<string, { shares: number; ntdTotal: number }>()

    for (const holder of stock.holders) {
      const existing = uniqueHolders.get(holder.legislator)
      if (existing) {
        existing.shares += holder.shares
        existing.ntdTotal += holder.ntdTotal
      } else {
        uniqueHolders.set(holder.legislator, { shares: holder.shares, ntdTotal: holder.ntdTotal })
      }
    }

    let marketValue = 0
    const holderDetails = Array.from(uniqueHolders.entries()).map(([councilor, { shares, ntdTotal }]) => {
      const value = price ? Math.round(shares * price.price) : ntdTotal
      marketValue += value
      const portfolio = personTotals.get(councilor) || 1
      return {
        councilor,
        value,
        pctOfPortfolio: Math.round((value / portfolio) * 100),
        href: hrefMap[councilor],
      }
    }).sort((a, b) => b.value - a.value)

    return { name: stock.name, holderCount: stock.holderCount, marketValue, holderDetails }
  })

  const concentratedRows = allStocksWithDetails.flatMap(stock =>
    stock.holderDetails
      .filter(holder => holder.pctOfPortfolio >= 20 && holder.value >= 5_000_000)
      .map(holder => ({
        stock: stock.name,
        councilor: holder.councilor,
        href: holder.href,
        value: holder.value,
        pct: holder.pctOfPortfolio,
      }))
  ).sort((a, b) => b.pct - a.pct)

  const topStocksData: StockBarData[] = aggregatedStocks.slice(0, 10).map(stock => {
    const partyCounts: Record<string, number> = {}
    const uniqueCouncilors = new Set<string>()
    for (const holder of stock.holders) {
      if (uniqueCouncilors.has(holder.legislator)) continue
      uniqueCouncilors.add(holder.legislator)
      const party = rows.find(row => row.name === holder.legislator)?.party || '其他'
      partyCounts[party] = (partyCounts[party] || 0) + 1
    }
    return { name: stock.name, holderCount: stock.holderCount, partyCounts }
  })

  const stockListItems = aggregatedStocks.slice(0, 50).map((stock, index) => ({
    '@type': 'ListItem' as const,
    position: index + 1,
    item: {
      '@type': 'Thing' as const,
      name: stock.name,
      description: `${stock.holderCount} 位${cityName}議員持有`,
    },
  }))

  return (
    <div className="space-y-12">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${cityName}議員持有的股票及基金`,
        numberOfItems: aggregatedStocks.length,
        itemListElement: stockListItems,
      }} />

      <header className="space-y-3 pt-4">
        <Link href={`/councilor/${citySlug}`} className="text-sm text-muted-foreground underline hover:text-foreground">
          {cityName}議員
        </Link>
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">{cityName}議員持股總覽</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {rows.length} 位議員中有 {withHoldings.length} 位持有股票或基金，共 {new Set(holdings.map(h => h.name)).size} 檔標的、{holdings.length} 筆紀錄。
          </p>
        </div>
        <CouncilorCityNav citySlug={citySlug} />
      </header>

      {topStocksData.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">最多議員持有的股票</h2>
          <PartyBarChart stocks={topStocksData} />
        </section>
      )}

      {concentratedRows.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">個人重倉股</h2>
          <p className="text-sm text-muted-foreground">單一股票佔該議員持股 20% 以上，且市值超過 500 萬</p>
          <div className="divide-y">
            {concentratedRows.map((row, index) => (
              <div key={`${row.councilor}-${row.stock}-${index}`} className="flex items-center gap-3 py-2">
                <span className="w-10 shrink-0 font-heading text-sm font-black tabular-nums text-[#cc4444]">{row.pct}%</span>
                {row.href ? (
                  <Link href={row.href} className="shrink-0 text-sm font-medium hover:underline">{row.councilor}</Link>
                ) : (
                  <span className="shrink-0 text-sm font-medium">{row.councilor}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{row.stock}</span>
                <span className="shrink-0 text-xs font-bold tabular-nums"><CurrencyDisplay amount={row.value} /></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <StockTable
        rows={holdings}
        hrefMap={hrefMap}
        personLabel="議員"
        searchPlaceholder="輸入股票名稱或議員姓名..."
      />
    </div>
  )
}
