import { CategoryTabs, type HoldingRow } from "@/components/category-tabs"
import { HoldingsPie } from "@/components/holdings-pie"
import { JsonLd } from "@/components/json-ld"
import { PropertySummary } from "@/components/property-summary"
import { DeclarationDownloads } from "@/components/declaration-downloads"
import {
  getAllMayorMeta,
  getDeclarationPdfDownloads,
  getMayorChangesBySlug,
  getMayorDeclarationBySlug,
  getMayorDeclarationFilesBySlug,
  getMayorIndex,
  lookupStockPrice,
} from "@/lib/data"
import {
  getMayorCityName,
  getMayorCitySlug,
  getMayorCitySlugFromOrganization,
  getMayorMemberSlug,
} from "@/lib/mayor-routes"
import { formatDate, formatNTD } from "@/lib/format"
import { createOgImage } from "@/lib/metadata"
import { assetUrl, createBreadcrumbList, pageUrl } from "@/lib/structured-data"
import type { LegislatorDeclaration } from "@/lib/types"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
/* eslint-disable @next/next/no-img-element */

function getMayorEntry(citySlug: string, memberSlug: string) {
  return (
    getMayorIndex().mayors.find(
      (mayor) =>
        getMayorCitySlugFromOrganization(mayor.organization) === citySlug &&
        (mayor.slug === memberSlug ||
          getMayorMemberSlug(mayor.slug, citySlug) === memberSlug)
    ) ?? null
  )
}

function getMayorMeta(citySlug: string, memberSlug: string) {
  return (
    getAllMayorMeta().find(
      (meta) =>
        getMayorCitySlug(meta.city) === citySlug &&
        (meta.slug === memberSlug ||
          getMayorMemberSlug(meta.slug, citySlug) === memberSlug)
    ) ?? null
  )
}

export async function generateStaticParams() {
  return getMayorIndex()
    .mayors.filter((mayor) => mayor.declarations.length > 0)
    .map((mayor) => {
      const city = getMayorCitySlugFromOrganization(mayor.organization)
      return {
        city,
        name: getMayorMemberSlug(mayor.slug, city),
      }
    })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; name: string }>
}): Promise<Metadata> {
  const { city: citySlug, name: memberSlug } = await params
  const cityName = getMayorCityName(citySlug)
  const entry = getMayorEntry(citySlug, memberSlug)
  const data = entry ? getMayorDeclarationBySlug(entry.slug) : null
  const meta = getMayorMeta(citySlug, memberSlug)
  if (!cityName || !entry || !data) return { title: memberSlug }

  const amount = calcMarketTotal(data)
  const displayName = meta?.name ?? data.name
  const title = `${displayName} ${cityName}首長財產申報`
  const description = `${displayName}的${cityName}首長財產申報資料，股票及基金總市值約 NT$ ${formatNTD(amount)}。`
  const canonicalName = getMayorMemberSlug(entry.slug, citySlug)
  const url = `/mayor/${citySlug}/${canonicalName}/`
  const image = `/og/mayors/${entry.slug}.png`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      images: [createOgImage(image, title)],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}

function calcMarketTotal(data: LegislatorDeclaration): number {
  let total = 0
  for (const stock of data.securities.stocks.items) {
    const price = lookupStockPrice(stock.name, "stock")
    total += price ? Math.round(stock.shares * price.price) : stock.ntdTotal
  }
  for (const fund of data.securities.funds.items) {
    const price = lookupStockPrice(fund.name, "fund")
    total += price ? Math.round(fund.units * price.price) : fund.ntdTotal
  }
  return total
}

function buildHoldings(data: LegislatorDeclaration): HoldingRow[] {
  const rows: HoldingRow[] = []
  for (const stock of data.securities.stocks.items) {
    const price = lookupStockPrice(stock.name, "stock")
    rows.push({
      name: stock.name,
      owner: stock.owner,
      shares: stock.shares,
      ntdTotal: stock.ntdTotal,
      source: "stock",
      currency: stock.currency,
      marketPrice: price?.price,
      marketValue: price ? Math.round(stock.shares * price.price) : undefined,
    })
  }
  for (const fund of data.securities.funds.items) {
    const price = lookupStockPrice(fund.name, "fund")
    rows.push({
      name: fund.name,
      owner: fund.owner,
      shares: fund.units,
      ntdTotal: fund.ntdTotal,
      source: "fund",
      currency: fund.currency,
      marketPrice: price?.price,
      marketValue: price ? Math.round(fund.units * price.price) : undefined,
    })
  }
  return rows
}

export default async function MayorDetailPage({
  params,
}: {
  params: Promise<{ city: string; name: string }>
}) {
  const { city: citySlug, name: memberSlug } = await params
  const cityName = getMayorCityName(citySlug)
  const entry = getMayorEntry(citySlug, memberSlug)

  if (!cityName || !entry) {
    notFound()
  }

  const data = getMayorDeclarationBySlug(entry.slug)
  const meta = getMayorMeta(citySlug, memberSlug)

  if (!data) {
    notFound()
  }

  const displayName = meta?.name ?? data.name
  const canonicalMemberSlug = getMayorMemberSlug(entry.slug, citySlug)
  const holdings = buildHoldings(data)
  const changes = getMayorChangesBySlug(entry.slug)
  const marketTotal = calcMarketTotal(data)
  const stockCount =
    data.securities.stocks.items.length + data.securities.funds.items.length
  const downloads = getDeclarationPdfDownloads("mayors", [
    ...getMayorDeclarationFilesBySlug(entry.slug),
    ...(entry.changes ?? []),
  ])

  return (
    <div className="space-y-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: displayName,
          url: pageUrl(`/mayor/${citySlug}/${canonicalMemberSlug}`),
          ...(meta?.avatar ? { image: assetUrl(meta.avatar) } : {}),
          description: `${cityName}首長，持股總市值 NT$ ${formatNTD(marketTotal)}。`,
        }}
      />
      <JsonLd
        data={createBreadcrumbList([
          { name: "政治人物持股", path: "/" },
          { name: "縣市首長", path: "/mayor" },
          {
            name: displayName,
            path: `/mayor/${citySlug}/${canonicalMemberSlug}`,
          },
        ])}
      />

      <div className="flex items-start gap-4 pt-2">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-muted text-2xl font-bold text-muted-foreground sm:h-20 sm:w-20">
          {meta?.avatar ? (
            <img
              src={meta.avatar}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            displayName.charAt(0)
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{cityName}首長</span>
            {meta?.party && <span>{meta.party}</span>}
            <span className="tabular-nums">
              申報日 {formatDate(data.declarationDate)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {displayName}為{cityName}首長，依 {formatDate(data.declarationDate)}{" "}
        監察院財產申報資料，共持有 {stockCount} 檔有價證券，總市值約 NT${" "}
        {formatNTD(marketTotal)}。
      </p>

      <PropertySummary data={data} />
      {holdings.length > 0 && (
        <section className="overflow-hidden">
          <HoldingsPie holdings={holdings} />
        </section>
      )}
      <CategoryTabs holdings={holdings} changes={changes} />

      <Link
        href="/mayor"
        className="inline-flex text-sm text-muted-foreground underline hover:text-foreground"
      >
        返回縣市首長名單
      </Link>

      <DeclarationDownloads downloads={downloads} />
    </div>
  )
}
