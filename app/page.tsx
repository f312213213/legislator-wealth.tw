import { getAllDeclarations, getAggregatedStocks, lookupStockPrice, getLegislatorMeta, getSlugByName } from '@/lib/data'
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
  '中國國民黨': 'border-l-[#000099]',
  '民主進步黨': 'border-l-[#1B9431]',
  '台灣民眾黨': 'border-l-[#28C8C8]',
  '無黨籍': 'border-l-[#999999]',
}

const PARTY_BAR: Record<string, string> = {
  '中國國民黨': 'bar-kmt',
  '民主進步黨': 'bar-dpp',
  '台灣民眾黨': 'bar-tpp',
  '無黨籍': 'bar-ind',
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
  const hero = ranked[0]
  const heroMeta = hero ? getLegislatorMeta(hero.name) : null
  const heroAmount = hero ? marketTotals.get(hero.name) || 0 : 0
  const heroBorder = heroMeta?.party ? (PARTY_BORDER[heroMeta.party] || '') : ''
  const top2to10 = ranked.slice(1, 10)
  const rest = ranked.slice(10)

  const listData = rest.map((d, i) => {
    const meta = getLegislatorMeta(d.name)
    return {
      name: d.name,
      slug: getSlugByName(d.name),
      party: meta?.party || '',
      avatar: meta?.avatar || '',
      amount: marketTotals.get(d.name) || 0,
      rank: i + 11,
      borderColor: meta?.party ? (PARTY_BORDER[meta.party] || '') : '',
    }
  })

  // Top holder amount for percentage bars in top 10
  const maxAmount = heroAmount

  return (
    <div className="space-y-16">
      {/* Title */}
      <header className="pt-8 sm:pt-16 fade-up fade-up-1">
        <h1 className="font-heading text-5xl font-black tracking-tight sm:text-6xl">立委持股</h1>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>{declarations.length} 位第十一屆立法委員的股票及基金申報資料。資料來源為監察院公報，市值依據台灣證交所收盤價估算。</p>
          <p>部分立委尚無公開申報紀錄，故未列出。資料由程式自動解析申報 PDF，若有錯誤歡迎至 <a href="https://github.com/f312213213/legislator-wealth.tw/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">GitHub</a> 回報。</p>
        </div>
      </header>

      {/* Hero #1 */}
      {hero && (
        <section className="fade-up fade-up-2">
          <Link
            href={`/legislator/${getSlugByName(hero.name)}`}
            className="group block border-b pb-8"
          >
            <p className="text-sm text-muted-foreground mb-4">持股市值最高</p>
            <div className="flex items-end gap-5 sm:gap-8">
              <div className={`flex h-24 w-24 shrink-0 items-center justify-center bg-muted overflow-hidden border-l-4 ${heroBorder} sm:h-32 sm:w-32`}>
                {heroMeta?.avatar ? (
                  <Image src={heroMeta.avatar} alt={hero.name} width={128} height={128} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-muted-foreground">{hero.name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="font-heading text-4xl font-black tracking-tight group-hover:underline decoration-2 underline-offset-4 sm:text-5xl">{hero.name}</h2>
                <p className="text-sm text-muted-foreground">{heroMeta?.party}</p>
                <p className="text-2xl font-black tabular-nums tracking-tight sm:text-3xl">
                  <CurrencyDisplay amount={heroAmount} />
                </p>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* #2-10 with proportional bars */}
      <section className="space-y-3 fade-up fade-up-3">
        <h2 className="text-lg font-bold">第 2 – 10 名</h2>
        <div className="divide-y">
          {top2to10.map((decl, i) => {
            const meta = getLegislatorMeta(decl.name)
            const amount = marketTotals.get(decl.name) || 0
            const border = meta?.party ? (PARTY_BORDER[meta.party] || '') : ''
            const barClass = meta?.party ? (PARTY_BAR[meta.party] || 'bg-foreground/10') : 'bg-foreground/10'
            const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
            return (
              <Link
                key={decl.name}
                href={`/legislator/${getSlugByName(decl.name)}`}
                className="row-hover relative flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4"
              >
                {/* Background bar — proportional to #1 */}
                <div className={`absolute inset-y-0 left-0 ${barClass}`} style={{ width: `${pct}%` }} />
                {/* Content */}
                <span className="relative text-lg font-black text-muted-foreground/20 tabular-nums w-6 shrink-0 text-right">
                  {i + 2}
                </span>
                <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center bg-muted overflow-hidden border-l-2 ${border}`}>
                  {meta?.avatar ? (
                    <Image src={meta.avatar} alt={decl.name} width={40} height={40} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{decl.name.charAt(0)}</span>
                  )}
                </div>
                <div className="relative min-w-0 flex-1">
                  <span className="font-bold">{decl.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">{meta?.party}</span>
                </div>
                <span className="relative font-bold tabular-nums tracking-tight">
                  <CurrencyDisplay amount={amount} />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Popular stocks */}
      <section className="space-y-3 fade-up fade-up-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">最多立委持有的股票</h2>
          <Link href="/stocks" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            全部明細
          </Link>
        </div>
        <div className="space-y-1">
          {topStocks.map(s => {
            const maxCount = topStocks[0]?.holderCount || 1
            const pct = (s.holderCount / maxCount) * 100
            return (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-sm font-medium truncate">{s.name}</span>
                <div className="flex-1 h-6 bg-muted overflow-hidden">
                  <div className="h-full bg-foreground/20 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-14 text-right text-sm font-medium tabular-nums">{s.holderCount} 人</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* All legislators */}
      <section className="space-y-3 fade-up fade-up-5">
        <h2 className="text-lg font-bold">全部立委</h2>
        <SearchableList legislators={listData} />
      </section>

      {/* Footer */}
      <footer className="border-t pt-6 pb-10 text-xs text-muted-foreground space-y-1">
        <p>立委持股公開平台 — 資料來源為監察院公報，本站非官方網站。</p>
        <p>
          <a href="https://github.com/f312213213/legislator-wealth.tw" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">GitHub</a>
        </p>
      </footer>
    </div>
  )
}
