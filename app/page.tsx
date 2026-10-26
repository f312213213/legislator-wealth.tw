import { CountUp } from "@/components/count-up"
import { JsonLd } from "@/components/json-ld"
import {
  getAllCouncilorDeclarations,
  getAllDeclarations,
  getAllMayorDeclarations,
  getHoldingStat,
} from "@/lib/data"
import {
  CANDIDATE_BASE_PATH,
  getAllCandidates,
  getCandidateCities,
} from "@/lib/candidates"
import { createWebSiteJsonLd } from "@/lib/structured-data"
import {
  RiArrowRightLine,
  RiBankLine,
  RiBuilding2Line,
  RiUserStarLine,
} from "@remixicon/react"
import Link from "next/link"

export const metadata = {
  title: {
    absolute: "政治人物持股 — 立委、議員、縣市首長",
  },
  description:
    "台灣民意代表與地方首長持股資料入口，分類瀏覽立法委員、縣市議員與縣市首長資料。",
}

export default function PortalPage() {
  const legislatorStat = getHoldingStat(getAllDeclarations())
  const councilorStat = getHoldingStat(getAllCouncilorDeclarations())
  const mayorStat = getHoldingStat(getAllMayorDeclarations())
  const candidateCount = getAllCandidates().length
  const candidateCityCount = getCandidateCities().length

  const sections = [
    {
      title: "立法委員",
      href: "/legislator",
      icon: RiBankLine,
      eyebrow: "中央民意代表",
      stat: {
        ...legislatorStat,
        sub: "最多立委持有的股票",
      },
      links: [
        { label: "瀏覽立委", href: "/legislator" },
        { label: "看排行榜", href: "/legislator/rankings" },
        { label: "查股票", href: "/legislator/stocks" },
      ],
    },
    {
      title: "縣市議員",
      href: "/councilor",
      icon: RiBuilding2Line,
      eyebrow: "地方民意代表",
      stat: {
        ...councilorStat,
        sub: "最多議員持有的股票",
      },
      links: [
        { label: "縣市入口", href: "/councilor" },
        { label: "臺北市", href: "/councilor/taipei" },
        { label: "臺北排行", href: "/councilor/taipei/rankings" },
      ],
    },
    {
      title: "縣市首長",
      href: "/mayor",
      icon: RiUserStarLine,
      eyebrow: "地方行政首長",
      stat: {
        ...mayorStat,
        sub: "最多首長持有的股票",
      },
      links: [{ label: "申報入口", href: "/mayor" }],
    },
  ]

  return (
    <div className="space-y-12">
      <JsonLd data={createWebSiteJsonLd()} />

      <header className="space-y-4 pt-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              公開申報資料
            </p>
            <h1 className="mt-2 font-heading text-4xl font-black tracking-tight sm:text-5xl">
              政治人物持股
            </h1>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            資料由程式自動解析申報 PDF，若有錯誤歡迎至{" "}
            <a
              href="https://github.com/f312213213/legislator-wealth.tw/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              GitHub
            </a>{" "}
            回報。
          </p>
        </div>
      </header>

      <Link
        href={CANDIDATE_BASE_PATH}
        className="group fade-up block border-2 border-foreground bg-foreground text-background transition-all duration-200 ease-out hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--muted-foreground)]"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em]">
              <span className="bg-background px-1.5 py-0.5 text-foreground">
                特輯
              </span>
              <span className="opacity-70">2026 地方選舉</span>
            </p>
            <h2 className="font-heading text-3xl leading-none font-black tracking-tight sm:text-4xl">
              縣市長候選人財產申報
            </h2>
            <p className="text-sm opacity-70">
              {candidateCityCount} 縣市 · {candidateCount} 位候選人
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black tracking-wide">
            進入特輯
            <RiArrowRightLine className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1.5" />
          </span>
        </div>
      </Link>

      <section className="grid gap-5 lg:grid-cols-3">
        {sections.map((section, i) => {
          const Icon = section.icon
          return (
            <div key={section.title} className={`fade-up fade-up-${i + 1}`}>
              <article className="group relative flex h-full flex-col border-2 border-foreground bg-card transition-all duration-200 ease-out hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--foreground)]">
                <Link href={section.href} className="block flex-1 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
                        <span className="font-heading text-lg leading-none font-black text-foreground tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {section.eyebrow}
                      </p>
                      <h2 className="font-heading text-3xl leading-none font-black tracking-tight">
                        {section.title}
                      </h2>
                    </div>
                    <span className="flex size-11 shrink-0 items-center justify-center bg-foreground text-background transition-transform duration-200 ease-out group-hover:scale-110 group-hover:rotate-[-6deg]">
                      <Icon className="size-6" />
                    </span>
                  </div>
                  <div className="mt-7 border-t-2 border-foreground pt-5">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-heading text-5xl leading-none font-black tracking-tight sm:text-6xl">
                        {section.stat.topStock}
                      </span>
                      <span className="flex items-baseline font-heading text-xl leading-none font-black">
                        ×
                        <CountUp
                          value={section.stat.topStockHolders}
                          delayMs={i * 90 + 250}
                          className="tabular-nums"
                        />
                        人
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                      {section.stat.sub}
                    </p>
                  </div>
                  <div className="mt-7 inline-flex items-center gap-1.5 text-sm font-black tracking-wide uppercase">
                    進入資料
                    <RiArrowRightLine className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1.5" />
                  </div>
                </Link>
                <div className="flex flex-wrap gap-2 border-t-2 border-foreground p-3">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex h-7 items-center border border-foreground px-2.5 text-xs font-bold transition-colors duration-150 hover:bg-foreground hover:text-background"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </article>
            </div>
          )
        })}
      </section>
    </div>
  )
}
