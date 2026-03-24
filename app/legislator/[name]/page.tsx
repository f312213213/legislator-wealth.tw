import { getIndex, getDeclarationBySlug, getChangesBySlug, lookupStockPrice, getLegislatorMeta, getAllDeclarations, getSlugByName, PARTY_NAME_TO_SLUG } from '@/lib/data'
import { PropertySummary } from '@/components/property-summary'
import { CategoryTabs, type HoldingRow } from '@/components/category-tabs'
import { HoldingsPie } from '@/components/holdings-pie'
import { JsonLd } from '@/components/json-ld'
import { notFound } from 'next/navigation'
import { formatDate, formatNTD } from '@/lib/format'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import type { LegislatorDeclaration } from '@/lib/types'

export async function generateStaticParams() {
  const index = getIndex()
  return index.legislators.map(l => ({
    name: l.slug,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name: slug } = await params
  const data = getDeclarationBySlug(slug)
  if (!data) return { title: slug }

  const meta = getLegislatorMeta(data.name)
  const amount = calcMarketTotal(data)
  const stockCount = data.securities.stocks.items.length + data.securities.funds.items.length
  const topHolding = getTopHolding(data)
  const description = `${data.name}為${meta?.party ? `${meta.party}籍` : ''}第十一屆立法委員，共持有 ${stockCount} 檔有價證券，總市值約 NT$ ${formatNTD(amount)}${topHolding ? `，最大持股為${topHolding.name}` : ''}。`

  return {
    title: `${data.name} 立委持股 — 股票申報資料與市值分析`,
    description,
    alternates: {
      canonical: `/legislator/${slug}/`,
    },
    openGraph: {
      title: `${data.name} 立委持股 — 股票申報資料與市值分析`,
      description,
      url: `/legislator/${slug}/`,
      images: [{
        url: `/og/${slug}.png`,
        width: 1200,
        height: 630,
        alt: data.name,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.name,
      description,
      images: [`/og/${slug}.png`],
    },
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

function getTopHolding(data: LegislatorDeclaration): { name: string; code?: string; value: number } | null {
  let top: { name: string; code?: string; value: number } | null = null
  for (const s of data.securities.stocks.items) {
    const p = lookupStockPrice(s.name)
    const value = p ? Math.round(s.shares * p.price) : s.ntdTotal
    if (!top || value > top.value) {
      top = { name: s.name, code: p?.code, value }
    }
  }
  for (const f of data.securities.funds.items) {
    const p = lookupStockPrice(f.name)
    const value = p ? Math.round(f.units * p.price) : f.ntdTotal
    if (!top || value > top.value) {
      top = { name: f.name, code: p?.code, value }
    }
  }
  return top
}

function buildHoldings(data: LegislatorDeclaration): HoldingRow[] {
  const rows: HoldingRow[] = []
  for (const s of data.securities.stocks.items) {
    const p = lookupStockPrice(s.name)
    rows.push({
      name: s.name,
      owner: s.owner,
      shares: s.shares,
      ntdTotal: s.ntdTotal,
      source: 'stock',
      marketPrice: p?.price,
      marketValue: p ? Math.round(s.shares * p.price) : undefined,
    })
  }
  for (const f of data.securities.funds.items) {
    const p = lookupStockPrice(f.name)
    rows.push({
      name: f.name,
      owner: f.owner,
      shares: f.units,
      ntdTotal: f.ntdTotal,
      source: 'fund',
      marketPrice: p?.price,
      marketValue: p ? Math.round(f.units * p.price) : undefined,
    })
  }
  return rows
}

const PARTY_COLOR: Record<string, string> = {
  '中國國民黨': 'bg-[#1a5ccc]',
  '民主進步黨': 'bg-[#1B9431]',
  '台灣民眾黨': 'bg-[#28C8C8]',
  '無黨籍': 'bg-[#999999]',
}

export default async function LegislatorPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: slug } = await params
  const data = getDeclarationBySlug(slug)
  const changes = getChangesBySlug(slug)
  const meta = data ? getLegislatorMeta(data.name) : null

  if (!data) {
    notFound()
  }

  const holdings = buildHoldings(data)
  const partyDot = meta?.party ? (PARTY_COLOR[meta.party] || 'bg-muted-foreground') : ''
  const marketTotal = calcMarketTotal(data)
  const stockCount = data.securities.stocks.items.length + data.securities.funds.items.length
  const topHolding = getTopHolding(data)

  // Same-party legislators for cross-links
  const allDeclarations = getAllDeclarations()
  const samePartyLegislators = meta?.party
    ? allDeclarations
        .filter(d => d.name !== data.name && getLegislatorMeta(d.name)?.party === meta.party)
        .slice(0, 8)
    : []

  const partySlug = meta?.party ? PARTY_NAME_TO_SLUG[meta.party] : null

  return (
    <div className="space-y-8">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: data.name,
        ...(meta?.party ? { memberOf: { '@type': 'Organization', name: meta.party } } : {}),
        description: `第十一屆立法委員，持股總市值 NT$ ${formatNTD(marketTotal)}${topHolding ? `，最大持股為${topHolding.name}${topHolding.code ? `（${topHolding.code}）` : ''}` : ''}`,
      }} />

      {/* Profile header */}
      <div className="flex items-start gap-4 pt-2">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-muted text-2xl font-bold text-muted-foreground overflow-hidden sm:h-20 sm:w-20">
          {meta?.avatar ? (
            <img src={meta.avatar} alt={data.name} className="h-full w-full object-cover" />
          ) : (
            data.name.charAt(0)
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">{data.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {meta?.party && (
              <Link href={`/party/${partySlug}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <span className={`inline-block h-2 w-2 ${partyDot}`} />
                {meta.party}
              </Link>
            )}
            <span className="tabular-nums">申報日 {formatDate(data.declarationDate)}</span>
            {data.spouse && (
              <span>配偶：{data.spouse.name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Natural language description for SEO */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {data.name}為{meta?.party ? `${meta.party}籍` : ''}第十一屆立法委員，依 {formatDate(data.declarationDate)} 監察院財產申報資料，共持有 {stockCount} 檔有價證券，總市值約 NT$ {formatNTD(marketTotal)}{topHolding ? `，最大持股為${topHolding.name}${topHolding.code ? `（${topHolding.code}）` : ''}` : ''}。
      </p>

      <PropertySummary data={data} />
      {holdings.length > 0 && (
        <section className="space-y-3 overflow-hidden">
          <h2 className="text-lg font-bold">持股配置</h2>
          <HoldingsPie holdings={holdings} />
        </section>
      )}
      <CategoryTabs holdings={holdings} changes={changes} />

      {/* Cross-links: same party legislators */}
      {samePartyLegislators.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">同黨立委</h2>
            {partySlug && (
              <Link href={`/party/${partySlug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                查看全部
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {samePartyLegislators.map(d => (
              <Link
                key={d.name}
                href={`/legislator/${getSlugByName(d.name)}`}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm hover:bg-muted transition-colors"
              >
                {d.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
