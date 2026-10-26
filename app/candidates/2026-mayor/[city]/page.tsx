import {
  CandidateComparison,
  type CandidateComparisonColumn,
} from "@/components/candidate-comparison"
import { CandidatePortrait } from "@/components/candidate-portrait"
import {
  CandidateSelectionBadge,
  CandidateSelectionDialog,
  CandidateSelectionProvider,
  SelectedCandidate,
} from "@/components/candidate-selection"
import { JsonLd } from "@/components/json-ld"
import {
  CANDIDATE_BASE_PATH,
  getCandidateAvatar,
  getCandidateCities,
  getCandidateCity,
  getCandidateCityPath,
  getCandidateMarketTotal,
  getCandidatePath,
} from "@/lib/candidates"
import { createOgImage } from "@/lib/metadata"
import { createBreadcrumbList, pageUrl } from "@/lib/structured-data"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

export async function generateStaticParams() {
  return getCandidateCities().map((city) => ({ city: city.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>
}): Promise<Metadata> {
  const { city: citySlug } = await params
  const city = getCandidateCity(citySlug)
  if (!city) return { title: citySlug }

  const title = `2026 ${city.office}候選人財產申報比較`
  const description = `${city.candidates.map((candidate) => candidate.name).join("、")}，${city.candidates.length} 位${city.office}候選人的存款、持股市值、債務與不動產申報並列比較。`
  const url = `${getCandidateCityPath(city.slug)}/`
  const image = "/og/candidates-2026-mayor.png"

  return {
    title,
    description,
    alternates: { canonical: url },
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

export default async function CandidateCityPage({
  params,
}: {
  params: Promise<{ city: string }>
}) {
  const { city: citySlug } = await params
  const city = getCandidateCity(citySlug)
  if (!city) notFound()

  const columns: CandidateComparisonColumn[] = city.candidates.map(
    (candidate) => ({
      slug: candidate.slug,
      name: candidate.name,
      amounts: candidate.amounts,
      derived: candidate.derived,
      counts: candidate.counts,
      href: getCandidatePath(candidate),
      market: getCandidateMarketTotal(candidate),
      holdingCount: candidate.stocks.length + candidate.funds.length,
    })
  )
  const otherCities = getCandidateCities().filter(
    (other) => other.slug !== city.slug
  )

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `2026 ${city.office}候選人財產申報`,
          url: pageUrl(getCandidateCityPath(city.slug)),
        }}
      />
      <JsonLd
        data={createBreadcrumbList([
          { name: "政治人物持股", path: "/" },
          { name: "縣市長候選人特輯", path: CANDIDATE_BASE_PATH },
          {
            name: `${city.office}候選人`,
            path: getCandidateCityPath(city.slug),
          },
        ])}
      />

      <CandidateSelectionProvider
        candidates={city.candidates.map(({ slug, name, party }) => ({
          slug,
          name,
          party,
        }))}
      >
        <header className="space-y-3 pt-4">
          <Link
            href={CANDIDATE_BASE_PATH}
            className="flex w-fit items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            <span className="bg-foreground px-1.5 py-0.5 text-background">
              特輯
            </span>
            2026 縣市長候選人
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
              {city.office}候選人
            </h1>
            <CandidateSelectionBadge />
          </div>
        </header>

        <ul className="grid grid-cols-2 border-t border-l lg:grid-cols-3 lg:[&:has(>li:nth-child(2):last-child)]:grid-cols-2 [&:has(>li:only-child)]:grid-cols-1">
          {city.candidates.map((candidate) => (
            <SelectedCandidate key={candidate.slug} slug={candidate.slug}>
              <li className="border-r border-b">
                <Link
                  href={getCandidatePath(candidate)}
                  className="group flex h-full flex-col items-start gap-3 p-3 transition-colors duration-150 hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
                >
                  <CandidatePortrait
                    name={candidate.name}
                    party={candidate.party}
                    avatar={getCandidateAvatar(candidate)}
                  />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    {(candidate.ballotNumber || candidate.incumbent) && (
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {[
                          candidate.ballotNumber &&
                            `${candidate.ballotNumber} 號`,
                          candidate.incumbent && "現任",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    <span className="block font-heading text-xl font-black tracking-tight break-all decoration-2 underline-offset-4 group-hover:underline sm:text-2xl">
                      {candidate.name}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {candidate.party}
                    </span>
                  </span>
                </Link>
              </li>
            </SelectedCandidate>
          ))}
        </ul>

        <section className="space-y-3" aria-labelledby="compare-title">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="compare-title" className="text-lg font-bold">
              財產並列
            </h2>
            <CandidateSelectionBadge />
          </div>
          <CandidateComparison
            caption={`${city.office}候選人各類申報財產比較`}
            columns={columns}
          />
          <CandidateSelectionDialog />
        </section>
      </CandidateSelectionProvider>

      <nav aria-labelledby="other-cities-title" className="space-y-3">
        <h2 id="other-cities-title" className="text-sm font-bold">
          其他縣市
        </h2>
        <div className="flex flex-wrap gap-2">
          {otherCities.map((other) => (
            <Link
              key={other.slug}
              href={getCandidateCityPath(other.slug)}
              className="inline-flex h-7 items-center border px-2.5 text-xs font-medium hover:bg-muted"
            >
              {other.office}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
