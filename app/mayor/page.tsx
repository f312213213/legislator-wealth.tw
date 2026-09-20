import { CurrencyDisplay } from "@/components/currency-display"
import { JsonLd } from "@/components/json-ld"
import { AdSenseInFeedAd } from "@/components/adsense-ad"
import { AD_INSERT_AFTER_INDEX, getInFeedAdConfig, shouldShowInFeedAd } from "@/lib/adsense"
import {
  getAllMayorMeta,
  getMayorDeclarationBySlug,
  getMayorIndex,
  lookupStockPrice,
} from "@/lib/data"
import { createOgImage } from "@/lib/metadata"
import { getMayorPath } from "@/lib/mayor-routes"
import { createBreadcrumbList } from "@/lib/structured-data"
import { RiArrowRightLine } from "@remixicon/react"
import Link from "next/link"
import { Fragment } from "react"
import type { LegislatorDeclaration } from "@/lib/types"
/* eslint-disable @next/next/no-img-element */

const title = "縣市首長財產申報 — 資料入口"
const description =
  "縣市長與直轄市長財產申報資料入口，提供已解析申報的持股排行與個別明細。"
const ogImage = "/og/mayor.png"

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/mayor/",
  },
  openGraph: {
    title,
    description,
    url: "/mayor/",
    images: [createOgImage(ogImage, "縣市首長持股")],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
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

export default function MayorPage() {
  const mayorIndex = getMayorIndex()
  const mayorMetaBySlug = new Map(
    getAllMayorMeta().map((mayor) => [mayor.slug, mayor])
  )
  const mayorRows = mayorIndex.mayors.flatMap((mayor) => {
    const declaration = getMayorDeclarationBySlug(mayor.slug)
    if (!declaration) return []

    const meta = mayorMetaBySlug.get(mayor.slug)
    const city = meta?.city ?? mayor.organization.replace(/政府$/g, "")

    return {
      ...mayor,
      city,
      party: meta?.party ?? "",
      avatar: meta?.avatar ?? "",
      href: getMayorPath(mayor),
      declaration,
      amount: calcMarketTotal(declaration),
      stockCount:
        declaration.securities.stocks.items.length +
        declaration.securities.funds.items.length,
    }
  })
  const rankedMayors = mayorRows.sort(
    (a, b) => b.amount - a.amount || a.city.localeCompare(b.city, "zh-TW")
  )
  const leader = rankedMayors[0]
  const restMayors = rankedMayors.slice(1)
  const inFeedAd = getInFeedAdConfig()

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "縣市首長財產申報",
          description:
            "縣市長與直轄市長財產申報資料入口，提供已解析申報的持股排行與個別明細。",
          url: "https://legislator-wealth.tw/mayor/",
        }}
      />
      <JsonLd
        data={createBreadcrumbList([
          { name: "政治人物持股", path: "/" },
          { name: "縣市首長", path: "/mayor" },
        ])}
      />

      <header className="space-y-3 pt-4">
        <p className="text-sm font-medium text-muted-foreground">
          地方行政首長
        </p>
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
          縣市首長財產申報
        </h1>
      </header>

      {leader && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">持股市值排行</h2>
          <Link href={leader.href} className="group block border-b pb-8">
            <p className="mb-4 text-sm text-muted-foreground">持股市值最高</p>
            <div className="flex items-end gap-5 sm:gap-8">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden bg-muted text-4xl font-black text-muted-foreground sm:h-32 sm:w-32">
                {leader.avatar ? (
                  <img
                    src={leader.avatar}
                    alt={leader.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  leader.name.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-heading text-4xl font-black tracking-tight decoration-2 underline-offset-4 group-hover:underline sm:text-5xl">
                  {leader.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {leader.city} · {leader.party || "未標示黨籍"} ·{" "}
                  {leader.stockCount} 檔
                </p>
                <p className="text-2xl font-black tracking-tight tabular-nums sm:text-3xl">
                  <CurrencyDisplay amount={leader.amount} animate />
                </p>
              </div>
            </div>
          </Link>

          {restMayors.length > 0 && (
            <div className="divide-y">
              {restMayors.map((mayor, index) => (
                <Fragment key={mayor.slug}>
                  <Link
                    href={mayor.href}
                    className="row-hover flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 sm:gap-4 sm:px-4"
                  >
                    <span className="w-9 shrink-0 text-right text-lg font-black text-muted-foreground/25 tabular-nums">
                      #{index + 2}
                    </span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-muted text-sm font-bold text-muted-foreground">
                      {mayor.avatar ? (
                        <img
                          src={mayor.avatar}
                          alt={mayor.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        mayor.name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold">{mayor.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {mayor.city}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-bold tracking-tight tabular-nums">
                        <CurrencyDisplay amount={mayor.amount} />
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {mayor.stockCount} 檔
                      </span>
                    </div>
                  </Link>
                  {shouldShowInFeedAd(inFeedAd, restMayors.length) && index === AD_INSERT_AFTER_INDEX && (
                    <AdSenseInFeedAd
                      client={inFeedAd.client}
                      slot={inFeedAd.slot}
                      layoutKey={inFeedAd.layoutKey}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </section>
      )}

      {!leader && (
        <section className="border-y py-8">
          <p className="text-sm text-muted-foreground">
            尚未建立可瀏覽的縣市首長財產申報資料。
          </p>
        </section>
      )}

      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
      >
        回入口
        <RiArrowRightLine className="size-4" />
      </Link>
    </div>
  )
}
