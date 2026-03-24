import { getAllDeclarations, getLegislatorMeta, lookupStockPrice, getSlugByName, PARTY_SLUG_MAP, PARTY_NAME_TO_SLUG } from '@/lib/data'
import { CurrencyDisplay } from '@/components/currency-display'
import { JsonLd } from '@/components/json-ld'
import { formatNTD } from '@/lib/format'
import Link from 'next/link'
import { notFound } from 'next/navigation'
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import type { LegislatorDeclaration } from '@/lib/types'

const PARTY_BORDER: Record<string, string> = {
  '中國國民黨': 'border-l-[#1a5ccc]',
  '民主進步黨': 'border-l-[#1B9431]',
  '台灣民眾黨': 'border-l-[#28C8C8]',
  '無黨籍': 'border-l-[#999999]',
}

export function generateStaticParams() {
  return Object.keys(PARTY_SLUG_MAP).map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const partyName = PARTY_SLUG_MAP[slug]
  if (!partyName) return { title: '找不到頁面' }
  return {
    title: `${partyName}立委持股一覽`,
    description: `${partyName}籍立法委員的股票及基金申報資料與持股市值排行。`,
    alternates: { canonical: `/party/${slug}/` },
  }
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

export default async function PartyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const partyName = PARTY_SLUG_MAP[slug]
  if (!partyName) notFound()

  const declarations = getAllDeclarations()
  const partyLegislators = declarations
    .filter(d => getLegislatorMeta(d.name)?.party === partyName)
    .map(d => ({
      decl: d,
      meta: getLegislatorMeta(d.name),
      marketTotal: calcMarketTotal(d),
    }))
    .sort((a, b) => b.marketTotal - a.marketTotal)

  const totalValue = partyLegislators.reduce((sum, l) => sum + l.marketTotal, 0)
  const border = PARTY_BORDER[partyName] || ''

  const listItems = partyLegislators.map((l, i) => ({
    '@type': 'ListItem' as const,
    position: i + 1,
    item: {
      '@type': 'Person' as const,
      name: l.decl.name,
      url: `https://legislator-wealth.tw/legislator/${getSlugByName(l.decl.name)}/`,
    },
  }))

  return (
    <div className="space-y-8">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${partyName}立委持股一覽`,
        numberOfItems: partyLegislators.length,
        itemListElement: listItems,
      }} />

      <header className="pt-4">
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">{partyName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          共 {partyLegislators.length} 位立委，持股總市值合計 NT$ {formatNTD(totalValue)}。
        </p>
      </header>

      <div className="divide-y">
        {partyLegislators.map((l, i) => (
          <Link
            key={l.decl.name}
            href={`/legislator/${getSlugByName(l.decl.name)}`}
            className="row-hover flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4"
          >
            <span className="text-lg font-black text-muted-foreground/20 tabular-nums w-6 shrink-0 text-right">
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
            </div>
            <span className="font-bold tabular-nums tracking-tight">
              <CurrencyDisplay amount={l.marketTotal}/>
            </span>
          </Link>
        ))}
      </div>

      {/* Links to other parties */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">其他政黨</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PARTY_SLUG_MAP)
            .filter(([s]) => s !== slug)
            .map(([s, name]) => (
              <Link key={s} href={`/party/${s}`} className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                {name}
              </Link>
            ))}
        </div>
      </section>
    </div>
  )
}
