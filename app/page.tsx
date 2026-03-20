import { getAllDeclarations, getAggregatedStocks, lookupStockPrice, getLegislatorMeta } from '@/lib/data'
import { CurrencyDisplay } from '@/components/currency-display'
import { SearchableList } from '@/components/searchable-list'
import Link from 'next/link'
import Image from 'next/image'
import type { LegislatorDeclaration } from '@/lib/types'

function calcMarketTotal(decl: LegislatorDeclaration): number {
  let total = 0
  for (const s of decl.securities.stocks.items) {
    const p = lookupStockPrice(s.name)
    total += p ? Math.round(s.shares * p.price) : s.ntdTotal
  }
  for (const f of decl.securities.funds.items) {
    const p = lookupStockPrice(f.name)
    total += p ? Math.round(f.units * p.price) : f.ntdTotal
  }
  return total
}

const PARTY_BORDER: Record<string, string> = {
  '國民黨': 'border-l-[#000099]',
  '民進黨': 'border-l-[#1B9431]',
  '民眾黨': 'border-l-[#28C8C8]',
  '無黨籍': 'border-l-[#999999]',
}

export default function HomePage() {
  const declarations = getAllDeclarations()
  const aggregatedStocks = getAggregatedStocks()

  const marketTotals = new Map<string, number>()
  for (const d of declarations) {
    marketTotals.set(d.name, calcMarketTotal(d))
  }

  const ranked = [...declarations].sort((a, b) =>
    (marketTotals.get(b.name) || 0) - (marketTotals.get(a.name) || 0)
  )

  const topStocks = aggregatedStocks.slice(0, 10)
  const top5 = ranked.slice(0, 5)
  const rest = ranked.slice(5)

  // Serialize for client component
  const listData = rest.map((d, i) => {
    const meta = getLegislatorMeta(d.name)
    return {
      name: d.name,
      party: meta?.party || '',
      avatar: meta?.avatar || '',
      amount: marketTotals.get(d.name) || 0,
      rank: i + 6,
      borderColor: meta?.party ? (PARTY_BORDER[meta.party] || '') : '',
    }
  })

  return (
    <div className="space-y-16">
      {/* Hero — editorial, not dashboard */}
      <header className="pt-8 sm:pt-12 space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">立委持股公開平台</h1>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <p>{declarations.length} 位第十一屆立法委員的股票及基金申報資料。資料來源為監察院公報，市值依據台灣證交所收盤價估算。</p>
          <p>部分立委尚無公開申報紀錄，故未列出。資料由程式自動解析申報 PDF，若有錯誤歡迎至 <a href="https://github.com/f312213213/legislator-wealth.tw/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">GitHub</a> 回報。</p>
        </div>
      </header>

      {/* Top 5 — Featured, big, editorial */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">持股市值前五名</h2>
        <div className="space-y-px">
          {top5.map((decl, i) => {
            const meta = getLegislatorMeta(decl.name)
            const amount = marketTotals.get(decl.name) || 0
            const border = meta?.party ? (PARTY_BORDER[meta.party] || '') : ''
            return (
              <Link
                key={decl.name}
                href={`/legislator/${encodeURIComponent(decl.name)}`}
                className="group flex items-center gap-4 bg-card px-4 py-4 transition-colors hover:bg-muted/50 sm:gap-6 sm:px-6 sm:py-5"
              >
                <span className="text-3xl font-bold text-muted-foreground/30 tabular-nums w-8 shrink-0 sm:text-4xl sm:w-10">
                  {i + 1}
                </span>
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center bg-muted overflow-hidden border-l-3 ${border} sm:h-16 sm:w-16`}>
                  {meta?.avatar ? (
                    <Image src={meta.avatar} alt={decl.name} width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-muted-foreground">{decl.name.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold leading-tight sm:text-xl">{decl.name}</h3>
                  {meta?.party && (
                    <p className="text-sm text-muted-foreground">{meta.party}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
                    <CurrencyDisplay amount={amount} />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Popular stocks — simple inline bars, not rainbow chart */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">最多立委持有的股票</h2>
          <Link href="/stocks" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            全部明細
          </Link>
        </div>
        <div className="space-y-2">
          {topStocks.map((s, i) => {
            const maxCount = topStocks[0]?.holderCount || 1
            const pct = (s.holderCount / maxCount) * 100
            return (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-sm font-medium truncate">{s.name}</span>
                <div className="flex-1 h-5 bg-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground/15"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">{s.holderCount} 人</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* All legislators — searchable list */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">全部立委</h2>
        <SearchableList legislators={listData} />
      </section>
    </div>
  )
}
