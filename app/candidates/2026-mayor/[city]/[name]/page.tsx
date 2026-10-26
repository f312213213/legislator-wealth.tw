import { AdSenseAd } from "@/components/adsense-ad"
import { CandidateAmount } from "@/components/candidate-amount"
import { CandidatePortrait } from "@/components/candidate-portrait"
import { StocksTab } from "@/components/category-tabs"
import { CurrencyDisplay } from "@/components/currency-display"
import { HoldingsPie } from "@/components/holdings-pie"
import { JsonLd } from "@/components/json-ld"
import { getDisplayAdConfig, getInFeedAdConfig } from "@/lib/adsense"
import {
  CANDIDATE_BASE_PATH,
  getAllCandidates,
  getCandidate,
  getCandidateAvatar,
  getCandidateCity,
  getCandidateCityPath,
  getCandidateHoldings,
  getCandidateMarketTotal,
  getCandidatePath,
  getCandidateRelatedLinks,
  getCandidateTextPdfHref,
} from "@/lib/candidates"
import {
  CANDIDATE_AMOUNT_FIELDS,
  CANDIDATE_COUNT_FIELDS,
  CANDIDATE_SECURITIES_FIELDS,
  getVisibleAmountFields,
  hasCandidateSummedAmount,
} from "@/lib/candidate-fields"
import { getCouncilorCitySlug } from "@/lib/councilor-routes"
import { formatDate, formatNTD } from "@/lib/format"
import { createOgImage } from "@/lib/metadata"
import { assetUrl, createBreadcrumbList, pageUrl } from "@/lib/structured-data"
import { RiArrowRightUpLine, RiFileTextLine } from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

export async function generateStaticParams() {
  return getAllCandidates().map((candidate) => ({
    city: getCouncilorCitySlug(candidate.city),
    name: candidate.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; name: string }>
}): Promise<Metadata> {
  const { city: citySlug, name } = await params
  const city = getCandidateCity(citySlug)
  const candidate = getCandidate(citySlug, name)
  if (!city || !candidate) return { title: name }

  const title = `${candidate.name} ${city.office}候選人財產申報`
  const deposits = candidate.amounts.deposits
  const description = `${candidate.name}（${candidate.party ?? "黨籍未標示"}）2026 ${city.office}候選人財產申報：${deposits === null ? "" : `存款約 NT$ ${formatNTD(Math.round(deposits))}、`}${candidate.stocks.length + candidate.funds.length} 檔股票及基金、${candidate.counts.land ?? 0} 筆土地、${candidate.counts.buildings ?? 0} 筆建物。`
  const url = `${getCandidatePath(candidate)}/`
  const image = `/og/candidates/2026-mayor/${citySlug}-${candidate.slug}.png`

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

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ city: string; name: string }>
}) {
  const { city: citySlug, name } = await params
  const city = getCandidateCity(citySlug)
  const candidate = getCandidate(citySlug, name)
  if (!city || !candidate) notFound()

  const avatar = getCandidateAvatar(candidate)
  const holdings = getCandidateHoldings(candidate)
  const marketTotal = getCandidateMarketTotal(candidate)
  const relatedLinks = getCandidateRelatedLinks(candidate)
  const opponents = city.candidates.filter(
    (other) => other.slug !== candidate.slug
  )
  const amountFields = getVisibleAmountFields(
    [...CANDIDATE_AMOUNT_FIELDS, ...CANDIDATE_SECURITIES_FIELDS],
    [candidate]
  )
  const path = getCandidatePath(candidate)
  const displayAd = getDisplayAdConfig()

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: candidate.name,
          url: pageUrl(path),
          ...(avatar ? { image: assetUrl(avatar) } : {}),
          description: `2026 ${city.office}候選人。`,
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
          { name: candidate.name, path },
        ])}
      />

      <header className="space-y-4 pt-2">
        <Link
          href={getCandidateCityPath(city.slug)}
          className="flex w-fit items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <span className="bg-foreground px-1.5 py-0.5 text-background">
            特輯
          </span>
          2026 {city.office}候選人
        </Link>
        <div className="flex items-start gap-4">
          <CandidatePortrait
            name={candidate.name}
            party={candidate.party}
            avatar={avatar}
            size="lg"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-heading text-3xl font-black tracking-tight break-all sm:text-4xl">
              {candidate.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {candidate.ballotNumber && (
                <span className="tabular-nums">
                  {candidate.ballotNumber} 號
                </span>
              )}
              <span>{candidate.party}</span>
              {candidate.incumbent && <span>現任</span>}
              {candidate.declarationDate && (
                <span className="tabular-nums">
                  申報日 {formatDate(candidate.declarationDate)}
                </span>
              )}
              {candidate.isCorrection && <span>補正申報</span>}
            </div>
          </div>
        </div>
        {relatedLinks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex h-7 items-center gap-1 border px-2.5 text-xs font-medium hover:bg-muted"
              >
                {link.label}
                <RiArrowRightUpLine className="size-3.5" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </header>

      <section className="space-y-3" aria-labelledby="assets-title">
        <h2 id="assets-title" className="text-lg font-bold">
          財產
        </h2>
        <dl className="grid grid-cols-2 border-t border-l sm:grid-cols-4">
          {amountFields.map((field) => (
            <div key={field.key} className="space-y-1 border-r border-b p-3">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-lg font-black tracking-tight tabular-nums sm:text-xl">
                <CandidateAmount candidate={candidate} field={field.key} />
              </dd>
            </div>
          ))}
          {CANDIDATE_COUNT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1 border-r border-b p-3">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="font-heading text-lg font-black tabular-nums sm:text-xl">
                {candidate.counts[field.key] === null
                  ? "--"
                  : `${candidate.counts[field.key]} ${field.unit}`}
              </dd>
            </div>
          ))}
          {candidate.amounts.trustTotal !== null && (
            <div className="space-y-1 border-r border-b p-3">
              <dt className="text-xs text-muted-foreground">信託財產</dt>
              <dd className="text-lg font-black tracking-tight tabular-nums sm:text-xl">
                <CurrencyDisplay amount={candidate.amounts.trustTotal} />
              </dd>
            </div>
          )}
        </dl>
        {hasCandidateSummedAmount(
          candidate,
          amountFields.map((field) => field.key)
        ) && <p className="text-xs text-muted-foreground">＊ 由明細加總</p>}
      </section>

      <section className="space-y-4" aria-labelledby="holdings-title">
        <div className="space-y-1 border-b pb-6">
          <h2 id="holdings-title" className="text-lg font-bold">
            持股市值
          </h2>
          <p className="text-4xl font-black tracking-tight sm:text-5xl">
            <CurrencyDisplay amount={marketTotal} animate />
          </p>
          <p className="text-sm text-muted-foreground">
            {candidate.stocks.length > 0 && `${candidate.stocks.length} 檔股票`}
            {candidate.stocks.length > 0 && candidate.funds.length > 0 && " · "}
            {candidate.funds.length > 0 && `${candidate.funds.length} 檔基金`}
            {holdings.length === 0 && "無股票或基金"}
          </p>
        </div>
        {holdings.length > 0 && (
          <>
            <div className="overflow-hidden">
              <HoldingsPie holdings={holdings} inFeedAd={getInFeedAdConfig()} />
            </div>
            <StocksTab holdings={holdings} showTotal={false} />
          </>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="sources-title">
        <h2 id="sources-title" className="text-sm font-bold">
          來源
        </h2>
        <ul className="space-y-2">
          {candidate.sources.map((source) => (
            <li
              key={source.fileId}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-medium hover:bg-muted"
              >
                <RiArrowRightUpLine className="size-4" aria-hidden="true" />
                中選會原件
                {candidate.sources.length > 1 && ` ${source.fileId}`}
              </a>
              <a
                href={getCandidateTextPdfHref(source)}
                download={`${candidate.name}_財產申報_文字版_${source.fileId}.pdf`}
                className="inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-medium hover:bg-muted"
              >
                <RiFileTextLine className="size-4" aria-hidden="true" />
                文字版
                {candidate.sources.length > 1 && ` ${source.fileId}`}
              </a>
            </li>
          ))}
          {candidate.photo && avatar === candidate.photo.src && (
            <li className="flex flex-wrap items-center gap-2 text-sm">
              <a
                href={candidate.photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-medium hover:bg-muted"
              >
                <RiArrowRightUpLine className="size-4" aria-hidden="true" />
                照片：{candidate.photo.credit}
              </a>
            </li>
          )}
        </ul>
      </section>

      {displayAd && <AdSenseAd {...displayAd} />}

      {opponents.length > 0 && (
        <nav aria-labelledby="opponents-title" className="space-y-3">
          <h2 id="opponents-title" className="text-lg font-bold">
            其他候選人
          </h2>
          <div className="divide-y border-y">
            {opponents.map((other) => (
              <Link
                key={other.slug}
                href={getCandidatePath(other)}
                className="row-hover flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
              >
                <CandidatePortrait
                  name={other.name}
                  party={other.party}
                  avatar={getCandidateAvatar(other)}
                  size="sm"
                  lazy
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-bold">{other.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {other.party}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="block text-xs text-muted-foreground">
                    存款
                  </span>
                  <CandidateAmount candidate={other} field="deposits" />
                </span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
