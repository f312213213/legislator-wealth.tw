import { CurrencyDisplay } from '@/components/currency-display'
import { JsonLd } from '@/components/json-ld'
import { getCouncilorMetaSource } from '@/lib/data'
import { getCouncilorCitySlug } from '@/lib/councilor-routes'
import { getCouncilorCitySummary } from '@/lib/councilor-analytics'
import Link from 'next/link'

export const metadata = {
  title: '地方議員財產申報 — 縣市議會持股資料',
  description: '地方議員名單取自內政部地方公職人員資訊專區，財產申報資料收錄各縣市議會申報 PDF 解析結果。',
}

export default function CouncilorPage() {
  const source = getCouncilorMetaSource()
  const citySummary = getCouncilorCitySummary()
  for (const city of source.cities) {
    const slug = getCouncilorCitySlug(city)
    citySummary[slug] ??= { name: city, councilors: 0, declarations: 0, marketTotal: 0, parties: new Set() }
  }

  const cityRows = Object.entries(citySummary)
    .map(([slug, city]) => ({
      slug,
      ...city,
      partyCount: city.parties.size,
    }))
    .sort((a, b) => b.declarations - a.declarations || b.councilors - a.councilors || a.name.localeCompare(b.name, 'zh-TW'))

  const councilorCount = cityRows.reduce((sum, city) => sum + city.councilors, 0)
  const declarationCount = cityRows.reduce((sum, city) => sum + city.declarations, 0)
  const marketTotal = cityRows.reduce((sum, city) => sum + city.marketTotal, 0)

  return (
    <div className="space-y-10">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '地方議員財產申報',
        description: '地方議員名單與各縣市議會股票、基金申報資料。',
        url: 'https://legislator-wealth.tw/councilor/',
      }} />

      <header className="space-y-3 pt-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">地方議員</p>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">縣市議會財產申報</h1>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          依縣市整理地方議員名單與財產申報解析結果。先支援臺北市議會；之後新增其他縣市時，會出現在同一個入口。
        </p>
        {source.fetchedAt && (
          <p className="text-xs text-muted-foreground">
            名單來源：<a href={source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">內政部直轄市議員資料</a>
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="border p-3">
          <p className="text-xs text-muted-foreground">已支援縣市</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{cityRows.length}</p>
        </div>
        <div className="border p-3">
          <p className="text-xs text-muted-foreground">地方議員</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{councilorCount}</p>
        </div>
        <div className="border p-3">
          <p className="text-xs text-muted-foreground">已解析持股市值</p>
          <p className="mt-1 text-2xl font-black tabular-nums">
            <CurrencyDisplay amount={marketTotal} />
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">依縣市瀏覽</h2>
        <div className="divide-y border-y">
          {cityRows.map(city => (
            <Link
              key={city.slug}
              href={`/councilor/${city.slug}`}
              className="row-hover grid gap-3 px-3 py-4 hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
              <div className="min-w-0">
                <h3 className="font-heading text-2xl font-black tracking-tight">{city.name}議員</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {city.partyCount} 種黨籍 · {city.councilors} 位議員
                </p>
              </div>
              <div className="text-sm sm:text-right">
                <p className="text-xs text-muted-foreground">已有申報</p>
                <p className="font-bold tabular-nums">{city.declarations} / {city.councilors}</p>
              </div>
              <div className="text-sm sm:text-right">
                <p className="text-xs text-muted-foreground">持股市值</p>
                <p className="font-bold tabular-nums"><CurrencyDisplay amount={city.marketTotal} /></p>
              </div>
              <div className="self-center text-sm text-muted-foreground sm:text-right">
                查看名單
              </div>
            </Link>
          ))}
        </div>
        {declarationCount === 0 && (
          <p className="text-xs text-muted-foreground">
            目前城市頁會先顯示官方議員名單；放入地方議員申報 PDF 並重新解析後，排行榜與持股統計會自動補上。
          </p>
        )}
      </section>
    </div>
  )
}
