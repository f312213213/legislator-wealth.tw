"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CurrencyDisplay } from "@/components/currency-display"
import { cn } from "@/lib/utils"

export type CandidateRankingMetric =
  | "deposits"
  | "market"
  | "debts"
  | "investments"
  | "realEstate"

export interface CandidateRankingRow {
  slug: string
  name: string
  city: string
  party: string | null
  href: string
  values: Record<CandidateRankingMetric, number | null>
}

const METRICS: {
  key: CandidateRankingMetric
  label: string
  unit?: string
}[] = [
  { key: "deposits", label: "存款" },
  { key: "market", label: "持股市值" },
  { key: "debts", label: "債務" },
  { key: "investments", label: "事業投資" },
  { key: "realEstate", label: "不動產", unit: "筆" },
]

const PARTY_BAR: Record<string, string> = {
  中國國民黨: "bar-kmt",
  民主進步黨: "bar-dpp",
  台灣民眾黨: "bar-tpp",
  無黨籍: "bar-ind",
}

const COLLAPSED_ROWS = 10

export function CandidateRanking({ rows }: { rows: CandidateRankingRow[] }) {
  const [metric, setMetric] = useState<CandidateRankingMetric>("deposits")
  const [expanded, setExpanded] = useState(false)
  const active = METRICS.find((item) => item.key === metric) ?? METRICS[0]

  const ranked = useMemo(
    () =>
      rows
        .filter((row) => (row.values[metric] ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.values[metric] ?? 0) - (a.values[metric] ?? 0) ||
            a.name.localeCompare(b.name, "zh-TW")
        ),
    [rows, metric]
  )
  const max = ranked[0]?.values[metric] ?? 0
  const visible = expanded ? ranked : ranked.slice(0, COLLAPSED_ROWS)

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="排行項目"
        className="flex flex-wrap gap-1.5"
      >
        {METRICS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={metric === item.key}
            onClick={() => {
              setMetric(item.key)
              setExpanded(false)
            }}
            className={cn(
              "inline-flex h-8 items-center border px-3 text-xs font-bold transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
              metric === item.key
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {ranked.length > 0 ? (
        <ol className="divide-y border-y">
          {visible.map((row, index) => {
            const value = row.values[metric] ?? 0
            const pct = max > 0 ? Math.max((value / max) * 100, 1.5) : 0
            return (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  className="row-hover relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0",
                      (row.party && PARTY_BAR[row.party]) || "bg-foreground/10"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative text-right text-lg font-black text-muted-foreground/25 tabular-nums">
                    #{index + 1}
                  </span>
                  <span className="relative min-w-0 truncate">
                    <span className="font-bold">{row.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {row.city}
                      {row.party ? ` · ${row.party}` : ""}
                    </span>
                  </span>
                  <span className="relative shrink-0 font-bold tracking-tight tabular-nums">
                    {active.unit ? (
                      <span className="font-heading">
                        {value} {active.unit}
                      </span>
                    ) : (
                      <CurrencyDisplay amount={value} />
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="border-y py-8 text-sm text-muted-foreground">無</p>
      )}

      {ranked.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex h-8 items-center border px-3 text-xs font-bold hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          {expanded ? "收合" : `顯示全部 ${ranked.length} 位`}
        </button>
      )}
    </div>
  )
}
