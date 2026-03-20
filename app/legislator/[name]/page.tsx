import { getIndex, getDeclarationBySlug, getChangesBySlug, lookupStockPrice, getLegislatorMeta } from '@/lib/data'
import { PropertySummary } from '@/components/property-summary'
import { CategoryTabs, type HoldingRow } from '@/components/category-tabs'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/format'
import Image from 'next/image'
import type { LegislatorDeclaration } from '@/lib/types'

export async function generateStaticParams() {
  const index = getIndex()
  return index.legislators.map(l => ({
    name: l.slug,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const data = getDeclarationBySlug(name)
  return {
    title: `${data?.name || name} — 立委持股公開平台`,
  }
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
  '國民黨': 'bg-[#000099]',
  '民進黨': 'bg-[#1B9431]',
  '民眾黨': 'bg-[#28C8C8]',
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

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="flex items-start gap-4 pt-2">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-muted text-2xl font-bold text-muted-foreground overflow-hidden sm:h-20 sm:w-20">
          {meta?.avatar ? (
            <Image src={meta.avatar} alt={data.name} width={80} height={80} className="h-full w-full object-cover" />
          ) : (
            data.name.charAt(0)
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">{data.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {meta?.party && (
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 ${partyDot}`} />
                {meta.party}
              </span>
            )}
            <span className="tabular-nums">{formatDate(data.declarationDate)}</span>
            {data.spouse && (
              <span>配偶：{data.spouse.name}</span>
            )}
          </div>
        </div>
      </div>

      <PropertySummary data={data} />
      <CategoryTabs holdings={holdings} changes={changes} />
    </div>
  )
}
