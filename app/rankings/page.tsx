import { getAllDeclarations, getLegislatorMeta, lookupStockPrice, getSlugByName, PARTY_NAME_TO_SLUG } from '@/lib/data'
import { CurrencyDisplay } from '@/components/currency-display'
import { JsonLd } from '@/components/json-ld'
import { formatNTD } from '@/lib/format'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element */
import type { LegislatorDeclaration } from '@/lib/types'

export const metadata = {
  title: '立委持股排行榜 — 持股市值排名',
  description: '台灣第十一屆立法委員依持股市值排名，查看哪位立委持有最多股票資產。',
}

const PARTY_BORDER: Record<string, string> = {
  '中國國民黨': 'border-l-[#1a5ccc]',
  '民主進步黨': 'border-l-[#1B9431]',
  '台灣民眾黨': 'border-l-[#28C8C8]',
  '無黨籍': 'border-l-[#999999]',
}

function calcMarketTotal(data: LegislatorDeclaration): number {
  let total = 0
  for (const s of data.securities.stocks.items) {
    const p = lookupStockPrice(s.name)
    total += p ? Math.round(s.shares * p.price) : s.ntdTotal
  }
  for (const f of data.securities.funds.items) {
    const p = lookupStockPrice(f.name)
    total += p ? Math.round(f.units * p.price) : f.ntdTotal
  }
  return total
}

export default function RankingsPage() {
  const declarations = getAllDeclarations()

  const ranked = declarations
    .map(d => {
      const meta = getLegislatorMeta(d.name)
      return {
        decl: d,
        meta,
        marketTotal: calcMarketTotal(d),
        stockCount: d.securities.stocks.items.length + d.securities.funds.items.length,
      }
    })
    .sort((a, b) => b.marketTotal - a.marketTotal)

  const listItems = ranked.map((l, i) => ({
    '@type': 'ListItem' as const,
    position: i + 1,
    item: {
      '@type': 'Person' as const,
      name: l.decl.name,
      url: `https://legislator-wealth.tw/legislator/${getSlugByName(l.decl.name)}/`,
    },
  }))

  // Party summary
  const partyTotals = new Map<string, { count: number; total: number }>()
  for (const l of ranked) {
    const party = l.meta?.party || '無黨籍'
    const existing = partyTotals.get(party) || { count: 0, total: 0 }
    existing.count++
    existing.total += l.marketTotal
    partyTotals.set(party, existing)
  }

  return (
    <div className="space-y-8">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '立法委員持股市值排行榜',
        numberOfItems: ranked.length,
        itemListElement: listItems,
      }} />

      <header className="pt-4">
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">持股市值排行榜</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ranked.length} 位立法委員依持股市值由高至低排列，市值依據台灣證交所收盤價估算。
        </p>
      </header>

      {/* Party summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">各黨持股市值合計</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from(partyTotals.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([party, { count, total }]) => {
              const slug = PARTY_NAME_TO_SLUG[party]
              const content = (
                <>
                  <p className="text-sm font-medium">{party}</p>
                  <p className="text-xs text-muted-foreground">{count} 位立委</p>
                  <p className="mt-1 text-sm font-bold tabular-nums">
                    <CurrencyDisplay amount={total} />
                  </p>
                </>
              )
              return slug ? (
                <Link key={party} href={`/party/${slug}`} className="rounded-lg border p-3 hover:bg-muted transition-colors">
                  {content}
                </Link>
              ) : (
                <div key={party} className="rounded-lg border p-3">
                  {content}
                </div>
              )
            })}
        </div>
      </section>

      {/* Full ranking */}
      <section className="divide-y">
        {ranked.map((l, i) => {
          const border = l.meta?.party ? (PARTY_BORDER[l.meta.party] || '') : ''
          return (
            <Link
              key={l.decl.name}
              href={`/legislator/${getSlugByName(l.decl.name)}`}
              className="row-hover flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4"
            >
              <span className="text-lg font-black text-muted-foreground/20 tabular-nums w-8 shrink-0 text-right">
                {i + 1}
              </span>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center bg-muted overflow-hidden border-l-2 ${border}`}>
                {l.meta?.avatar ? (
                  <img src={l.meta.avatar} alt={l.decl.name} width={40} height={40} className="h-full w-full object-cover"/>
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{l.decl.name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold">{l.decl.name}</span>
                <span className="text-sm text-muted-foreground ml-2">{l.meta?.party}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold tabular-nums tracking-tight">
                  <CurrencyDisplay amount={l.marketTotal}/>
                </span>
                <span className="block text-xs text-muted-foreground">{l.stockCount} 檔</span>
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
