import { JsonLd } from "@/components/json-ld"
import { AdSenseInFeedAd } from "@/components/adsense-ad"
import { AD_INSERT_AFTER_INDEX, getInFeedAdConfig, shouldShowInFeedAd } from "@/lib/adsense"
import { getCouncilorMetaSource } from "@/lib/data"
import { getCouncilorCitySlug } from "@/lib/councilor-routes"
import { getCouncilorCitySummary } from "@/lib/councilor-analytics"
import { createOgImage } from "@/lib/metadata"
import { createBreadcrumbList } from "@/lib/structured-data"
import Link from "next/link"
import { Fragment } from "react"

const title = "地方議員財產申報 — 縣市議會持股資料"
const description =
  "地方議員名單取自內政部地方公職人員資訊專區，財產申報資料收錄各縣市議會申報 PDF 解析結果。"
const ogImage = "/og/councilor.png"

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/councilor/",
  },
  openGraph: {
    title,
    description,
    url: "/councilor/",
    images: [createOgImage(ogImage, "地方議員持股")],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
}

export default function CouncilorPage() {
  const source = getCouncilorMetaSource()
  const citySummary = getCouncilorCitySummary()
  const inFeedAd = getInFeedAdConfig()
  for (const city of source.cities) {
    const slug = getCouncilorCitySlug(city)
    citySummary[slug] ??= {
      name: city,
      councilors: 0,
      declarations: 0,
      marketTotal: 0,
      parties: new Set(),
    }
  }

  const cityRows = Object.entries(citySummary)
    .map(([slug, city]) => ({
      slug,
      ...city,
      partyCount: city.parties.size,
    }))
    .filter((city) => city.declarations > 0)
    .sort(
      (a, b) =>
        b.declarations - a.declarations ||
        b.councilors - a.councilors ||
        a.name.localeCompare(b.name, "zh-TW")
    )

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "地方議員財產申報",
          description: "地方議員名單與各縣市議會股票、基金申報資料。",
          url: "https://legislator-wealth.tw/councilor/",
        }}
      />
      <JsonLd
        data={createBreadcrumbList([
          { name: "政治人物持股", path: "/" },
          { name: "縣市議員", path: "/councilor" },
        ])}
      />

      <header className="space-y-3 pt-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">地方議員</p>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            縣市議會財產申報
          </h1>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          依縣市整理地方議員名單與財產申報解析結果。名單來源涵蓋內政部的直轄市議員與縣市議員資料。
        </p>
        {source.fetchedAt && (
          <p className="text-xs text-muted-foreground">
            名單來源：
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              內政部直轄市議員資料
            </a>
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">依縣市瀏覽</h2>
        {cityRows.length > 0 ? (
          <div className="divide-y border-y">
            {cityRows.map((city, i) => (
              <Fragment key={city.slug}>
                <Link
                  href={`/councilor/${city.slug}`}
                  className="row-hover block px-3 py-4 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <h3 className="font-heading text-2xl font-black tracking-tight">
                      {city.name}議員
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {city.partyCount} 種黨籍 · {city.councilors} 位議員
                    </p>
                  </div>
                </Link>
                {shouldShowInFeedAd(inFeedAd, cityRows.length) && i === AD_INSERT_AFTER_INDEX && (
                  <AdSenseInFeedAd
                    client={inFeedAd.client}
                    slot={inFeedAd.slot}
                    layoutKey={inFeedAd.layoutKey}
                  />
                )}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="border-y py-8">
            <p className="text-sm text-muted-foreground">
              尚未建立可瀏覽的縣市議員財產申報資料。
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
