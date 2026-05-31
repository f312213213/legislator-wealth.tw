import { ChangeFeed } from '@/components/change-feed'
import { CouncilorCityNav } from '@/components/councilor-city-nav'
import { getCouncilorCityName } from '@/lib/councilor-routes'
import {
  buildCouncilorRows,
  getCouncilorCityStaticParams,
  getCouncilorFlatChanges,
  getCouncilorHrefMap,
} from '@/lib/councilor-analytics'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  return getCouncilorCityStaticParams()
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: citySlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  return {
    title: cityName ? `${cityName}議員股票變動紀錄` : '地方議員股票變動紀錄',
    description: cityName ? `${cityName}議員於申報期間內的股票交易異動紀錄。` : '地方議員於申報期間內的股票交易異動紀錄。',
  }
}

export default async function CouncilorChangesPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params
  const cityName = getCouncilorCityName(citySlug)
  if (!cityName) notFound()

  const rows = buildCouncilorRows(citySlug)
  if (rows.length === 0) notFound()

  const changes = getCouncilorFlatChanges(citySlug)
  const hrefMap = getCouncilorHrefMap(citySlug)

  return (
    <div className="space-y-8">
      <header className="space-y-3 pt-4">
        <Link href={`/councilor/${citySlug}`} className="text-sm text-muted-foreground underline hover:text-foreground">
          {cityName}議員
        </Link>
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">{cityName}議員變動紀錄</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cityName}議員於申報期間內的股票異動紀錄，可依議員姓名或股票名稱篩選。
          </p>
        </div>
        <CouncilorCityNav citySlug={citySlug} />
      </header>

      <ChangeFeed changes={changes} hrefMap={hrefMap} personLabel="議員" />
    </div>
  )
}
