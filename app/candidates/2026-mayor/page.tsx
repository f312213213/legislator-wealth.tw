import { AdSenseAd } from "@/components/adsense-ad"
import {
  CandidateRanking,
  type CandidateRankingRow,
} from "@/components/candidate-ranking"
import { CurrencyDisplay } from "@/components/currency-display"
import { JsonLd } from "@/components/json-ld"
import { getDisplayAdConfig } from "@/lib/adsense"
import {
  CANDIDATE_BASE_PATH,
  getAllCandidates,
  getCandidateCities,
  getCandidateCityPath,
  getCandidateElection,
  getCandidateHoldings,
  getCandidateMarketTotal,
  getCandidatePath,
  getCandidateRealEstateCount,
} from "@/lib/candidates"
import { createOgImage } from "@/lib/metadata"
import { createBreadcrumbList, pageUrl } from "@/lib/structured-data"
import Link from "next/link"

const title = "2026 縣市長候選人財產申報特輯"
const description =
  "2026 地方選舉直轄市長與縣市長候選人財產申報整理：存款、持股市值、債務、不動產筆數與持股明細，依縣市並列比較。"
const ogImage = "/og/candidates-2026-mayor.png"

export const metadata = {
  title,
  description,
  alternates: {
    canonical: `${CANDIDATE_BASE_PATH}/`,
  },
  openGraph: {
    title,
    description,
    url: `${CANDIDATE_BASE_PATH}/`,
    images: [createOgImage(ogImage, "縣市長候選人財產申報特輯")],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
}

function buildTopHoldings() {
  const holdings = new Map<
    string,
    { name: string; holders: Set<string>; total: number }
  >()
  for (const candidate of getAllCandidates()) {
    for (const row of getCandidateHoldings(candidate)) {
      const holding = holdings.get(row.name) ?? {
        name: row.name,
        holders: new Set<string>(),
        total: 0,
      }
      holding.holders.add(candidate.name)
      holding.total += row.marketValue ?? row.ntdTotal
      holdings.set(row.name, holding)
    }
  }

  return Array.from(holdings.values())
    .filter((holding) => holding.holders.size > 1)
    .map((holding) => ({
      name: holding.name,
      holders: Array.from(holding.holders),
      total: Math.round(holding.total),
    }))
    .sort((a, b) => b.holders.length - a.holders.length || b.total - a.total)
    .slice(0, 10)
}

export default function CandidateSpecialPage() {
  const { election } = getCandidateElection()
  const candidates = getAllCandidates()
  const cities = getCandidateCities()
  const displayAd = getDisplayAdConfig()
  const rankingRows: CandidateRankingRow[] = candidates.map((candidate) => ({
    slug: `${candidate.city}-${candidate.slug}`,
    name: candidate.name,
    city: candidate.city,
    party: candidate.party,
    href: getCandidatePath(candidate),
    values: {
      deposits: candidate.amounts.deposits,
      market: getCandidateMarketTotal(candidate),
      debts: candidate.amounts.debts,
      investments: candidate.amounts.investments,
      realEstate: getCandidateRealEstateCount(candidate),
    },
  }))
  const topHoldings = buildTopHoldings()
  const cityGroups = [
    {
      label: "直轄市長",
      cities: cities.filter((city) => city.isSpecialMunicipality),
    },
    {
      label: "縣市長",
      cities: cities.filter((city) => !city.isSpecialMunicipality),
    },
  ]

  return (
    <div className="space-y-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: pageUrl(CANDIDATE_BASE_PATH),
        }}
      />
      <JsonLd
        data={createBreadcrumbList([
          { name: "政治人物持股", path: "/" },
          { name: "縣市長候選人特輯", path: CANDIDATE_BASE_PATH },
        ])}
      />

      <header className="space-y-3 pt-4">
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-muted-foreground">
          <span className="bg-foreground px-1.5 py-0.5 text-background">
            特輯
          </span>
          {election.title}
        </p>
        <h1 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
          縣市長候選人財產申報
        </h1>
        <p className="text-xs text-muted-foreground">
          資料來源：
          <a
            href={election.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            中選會
          </a>
        </p>
      </header>

      <section className="space-y-6" aria-labelledby="cities-title">
        <h2 id="cities-title" className="text-lg font-bold">
          縣市
        </h2>
        {cityGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="text-xs font-bold tracking-[0.12em] text-muted-foreground">
              {group.label}
            </h3>
            <ul className="grid grid-cols-2 border-t border-l lg:grid-cols-3">
              {group.cities.map((city) => (
                <li key={city.slug} className="border-r border-b">
                  <Link
                    href={getCandidateCityPath(city.slug)}
                    className="group flex h-full flex-col gap-2 p-3 transition-colors duration-150 hover:bg-muted/50 sm:p-4"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-heading text-xl font-black tracking-tight decoration-2 underline-offset-4 group-hover:underline sm:text-2xl">
                        {city.office}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
                        {city.candidates.length} 位
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:line-clamp-none sm:text-sm">
                      {city.candidates
                        .map((candidate) => candidate.name)
                        .join("、")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-3" aria-labelledby="ranking-title">
        <h2 id="ranking-title" className="text-lg font-bold">
          排行
        </h2>
        <CandidateRanking rows={rankingRows} />
      </section>

      {displayAd && <AdSenseAd {...displayAd} />}

      {topHoldings.length > 0 && (
        <section className="space-y-3" aria-labelledby="holdings-title">
          <h2 id="holdings-title" className="text-lg font-bold">
            熱門持股
          </h2>
          <div className="divide-y border-y">
            {topHoldings.map((holding, index) => (
              <div
                key={holding.name}
                className="grid gap-2 px-3 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="hidden text-right text-lg font-black text-muted-foreground/25 tabular-nums sm:block">
                  #{index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{holding.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {holding.holders.join("、")}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-bold tabular-nums">
                    {holding.holders.length} 位
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <CurrencyDisplay amount={holding.total} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
