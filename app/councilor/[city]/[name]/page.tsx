import { CategoryTabs, type HoldingRow } from '@/components/category-tabs'
import { HoldingsPie } from '@/components/holdings-pie'
import { JsonLd } from '@/components/json-ld'
import { PropertySummary } from '@/components/property-summary'
import {
  getAllCouncilorMeta,
  getCouncilorChangesBySlug,
  getCouncilorDeclarationBySlug,
  getCouncilorIndex,
  getCouncilorIndexEntryByCityAndMemberSlug,
  getCouncilorMetaByCityAndMemberSlug,
  getCouncilorSlugByCityAndMemberSlug,
  lookupStockPrice,
} from '@/lib/data'
import {
  getCouncilorCityName,
  getCouncilorCitySlug,
  getCouncilorCitySlugFromOrganization,
  getCouncilorMemberSlug,
} from '@/lib/councilor-routes'
import { formatDate, formatNTD } from '@/lib/format'
import type { LegislatorDeclaration } from '@/lib/types'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
/* eslint-disable @next/next/no-img-element */

export async function generateStaticParams() {
  const params = new Map<string, { city: string; name: string }>()

  for (const meta of getAllCouncilorMeta()) {
    const city = getCouncilorCitySlug(meta.city)
    const name = getCouncilorMemberSlug(meta.slug, city)
    params.set(`${city}/${name}`, { city, name })
  }

  for (const councilor of getCouncilorIndex().councilors) {
    const city = getCouncilorCitySlugFromOrganization(councilor.organization)
    const name = getCouncilorMemberSlug(councilor.slug, city)
    params.set(`${city}/${name}`, { city, name })
  }

  return Array.from(params.values())
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; name: string }> }): Promise<Metadata> {
  const { city: citySlug, name: memberSlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  const slug = getCouncilorSlugByCityAndMemberSlug(citySlug, memberSlug)
  const meta = getCouncilorMetaByCityAndMemberSlug(citySlug, memberSlug)
  const entry = getCouncilorIndexEntryByCityAndMemberSlug(citySlug, memberSlug)
  const data = getCouncilorDeclarationBySlug(slug)
  if (!cityName || (!meta && !entry && !data)) return { title: memberSlug }

  const displayName = meta?.name ?? data?.name ?? entry?.name ?? memberSlug
  const title = `${displayName} ${cityName}議員財產申報`
  const amount = data ? calcMarketTotal(data) : 0
  const canonicalName = getCouncilorMemberSlug(slug, citySlug)
  const description = data
    ? `${displayName}的${cityName}議員財產申報資料，共持有股票及基金市值約 NT$ ${formatNTD(amount)}。`
    : `${displayName}的${cityName}議員頁面，名單資料取自內政部地方公職人員資訊專區。`

  return {
    title,
    description,
    alternates: {
      canonical: `/councilor/${citySlug}/${canonicalName}/`,
    },
    openGraph: {
      title,
      description,
      url: `/councilor/${citySlug}/${canonicalName}/`,
    },
  }
}

function calcMarketTotal(data: LegislatorDeclaration): number {
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

function buildHoldings(data: LegislatorDeclaration): HoldingRow[] {
  const rows: HoldingRow[] = []
  for (const s of data.securities.stocks.items) {
    const p = lookupStockPrice(s.name, 'stock')
    rows.push({
      name: s.name,
      owner: s.owner,
      shares: s.shares,
      ntdTotal: s.ntdTotal,
      source: 'stock',
      currency: s.currency,
      marketPrice: p?.price,
      marketValue: p ? Math.round(s.shares * p.price) : undefined,
    })
  }
  for (const f of data.securities.funds.items) {
    const p = lookupStockPrice(f.name, 'fund')
    rows.push({
      name: f.name,
      owner: f.owner,
      shares: f.units,
      ntdTotal: f.ntdTotal,
      source: 'fund',
      currency: f.currency,
      marketPrice: p?.price,
      marketValue: p ? Math.round(f.units * p.price) : undefined,
    })
  }
  return rows
}

export default async function CouncilorDetailPage({ params }: { params: Promise<{ city: string; name: string }> }) {
  const { city: citySlug, name: memberSlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  if (!cityName) notFound()

  const slug = getCouncilorSlugByCityAndMemberSlug(citySlug, memberSlug)
  const meta = getCouncilorMetaByCityAndMemberSlug(citySlug, memberSlug)
  const entry = getCouncilorIndexEntryByCityAndMemberSlug(citySlug, memberSlug)
  const data = getCouncilorDeclarationBySlug(slug)
  const changes = getCouncilorChangesBySlug(slug)

  if (!meta && !entry && !data) {
    notFound()
  }

  const displayName = meta?.name ?? data?.name ?? entry!.name
  const avatar = meta?.avatar
  const holdings = data ? buildHoldings(data) : []
  const marketTotal = data ? calcMarketTotal(data) : 0
  const stockCount = data ? data.securities.stocks.items.length + data.securities.funds.items.length : 0

  return (
    <div className="space-y-8">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: displayName,
        ...(meta?.party ? { memberOf: { '@type': 'Organization', name: meta.party } } : {}),
        description: data
          ? `${cityName}議員，持股總市值 NT$ ${formatNTD(marketTotal)}`
          : `${cityName}議員`,
      }} />

      <div className="flex items-start gap-4 pt-2">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-muted text-2xl font-bold text-muted-foreground sm:h-20 sm:w-20">
          {avatar ? (
            <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            displayName.charAt(0)
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">{displayName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{meta?.organization ?? data?.organization ?? entry?.organization}</span>
            <span>{meta?.title ?? data?.title ?? entry?.title}</span>
            {meta?.party && <span>{meta.party}</span>}
            {data?.declarationDate && <span className="tabular-nums">申報日 {formatDate(data.declarationDate)}</span>}
          </div>
        </div>
      </div>

      {data ? (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {displayName}為{meta?.party ? `${meta.party}籍` : ''}{cityName}議員，依 {formatDate(data.declarationDate)} 監察院財產申報資料，共持有 {stockCount} 檔有價證券，總市值約 NT$ {formatNTD(marketTotal)}。
          </p>
          <PropertySummary data={data} />
          {holdings.length > 0 && (
            <section className="overflow-hidden">
              <HoldingsPie holdings={holdings} />
            </section>
          )}
          <CategoryTabs holdings={holdings} changes={changes} />
        </>
      ) : (
        <section className="border-y py-8">
          <p className="text-sm text-muted-foreground">目前尚無已解析的股票或基金申報資料。</p>
          {meta?.detailUrl && (
            <a href={meta.detailUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm underline hover:text-foreground">
              內政部議員資料
            </a>
          )}
        </section>
      )}

      <Link href={`/councilor/${citySlug}`} className="inline-flex text-sm text-muted-foreground underline hover:text-foreground">
        返回{cityName}議員名單
      </Link>
    </div>
  )
}
