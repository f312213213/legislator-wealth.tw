import { getIndex, getDeclarationByName, getChangesByName, lookupStockPrice } from '@/lib/data'
import { PropertySummary } from '@/components/property-summary'
import { CategoryTabs, type HoldingRow } from '@/components/category-tabs'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/format'
import type { LegislatorDeclaration } from '@/lib/types'

export async function generateStaticParams() {
  const index = getIndex()
  return index.legislators.map(l => ({
    name: encodeURIComponent(l.name),
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  return {
    title: `${decodedName} — 立委持股公開平台`,
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

export default async function LegislatorPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  const data = getDeclarationByName(decodedName)
  const changes = getChangesByName(decodedName)

  if (!data) {
    notFound()
  }

  const holdings = buildHoldings(data)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <span className="text-sm text-muted-foreground tabular-nums">{formatDate(data.declarationDate)}</span>
        {data.spouse && (
          <span className="text-sm text-muted-foreground">配偶：{data.spouse.name}</span>
        )}
      </div>

      <PropertySummary data={data} />
      <CategoryTabs holdings={holdings} changes={changes} />
    </div>
  )
}
