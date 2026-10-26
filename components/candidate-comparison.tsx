"use client"

import Link from "next/link"
import { CandidateAmount } from "@/components/candidate-amount"
import { useSelectedCandidates } from "@/components/candidate-selection"
import { CurrencyDisplay } from "@/components/currency-display"
import {
  CANDIDATE_AMOUNT_FIELDS,
  CANDIDATE_COUNT_FIELDS,
  CANDIDATE_SECURITIES_FIELDS,
  getVisibleAmountFields,
  hasCandidateSummedAmount,
} from "@/lib/candidate-fields"
import type { CandidateDeclaration } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface CandidateComparisonColumn extends Pick<
  CandidateDeclaration,
  "slug" | "name" | "amounts" | "derived" | "counts"
> {
  href: string
  market: number
  holdingCount: number
}

const ROW_HEADER =
  "sticky left-0 z-10 bg-background px-3 py-2.5 text-left font-medium whitespace-nowrap"

function maxOf(values: (number | null)[]): number {
  return Math.max(0, ...values.map((value) => value ?? 0))
}

function isMax(value: number | null, max: number): boolean {
  return max > 0 && (value ?? 0) === max
}

export function CandidateComparison({
  caption,
  columns: allColumns,
}: {
  caption: string
  columns: CandidateComparisonColumn[]
}) {
  const selected = useSelectedCandidates()
  const columns = allColumns.filter((column) => selected.has(column.slug))
  const amountFields = getVisibleAmountFields(CANDIDATE_AMOUNT_FIELDS, columns)
  const securitiesFields = getVisibleAmountFields(
    CANDIDATE_SECURITIES_FIELDS,
    columns
  )
  const hasTrust = columns.some((column) => column.amounts.trustTotal !== null)
  const hasDerived = columns.some((column) =>
    hasCandidateSummedAmount(
      column,
      [...amountFields, ...securitiesFields].map((field) => field.key)
    )
  )
  const marketMax = maxOf(columns.map((column) => column.market))

  function renderAmountRow(field: (typeof amountFields)[number]) {
    const max = maxOf(columns.map((column) => column.amounts[field.key]))
    return (
      <tr key={field.key}>
        <th scope="row" className={ROW_HEADER}>
          {field.label}
        </th>
        {columns.map((column) => (
          <td
            key={column.slug}
            className={cn(
              "px-3 py-2.5 text-right tabular-nums",
              isMax(column.amounts[field.key], max) && "font-black"
            )}
          >
            <CandidateAmount candidate={column} field={field.key} />
          </td>
        ))}
      </tr>
    )
  }

  return (
    <>
      <div className="overflow-x-auto border-y">
        <table className="w-full min-w-max text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-background px-3 py-2.5 text-left"
              >
                <span className="sr-only">項目</span>
              </th>
              {columns.map((column) => (
                <th
                  key={column.slug}
                  scope="col"
                  className="min-w-32 px-3 py-2.5 text-right"
                >
                  <Link
                    href={column.href}
                    className="font-bold hover:underline"
                  >
                    {column.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {amountFields.map(renderAmountRow)}
            <tr>
              <th scope="row" className={ROW_HEADER}>
                持股市值
              </th>
              {columns.map((column) => (
                <td
                  key={column.slug}
                  className={cn(
                    "px-3 py-2.5 text-right tabular-nums",
                    isMax(column.market, marketMax) && "font-black"
                  )}
                >
                  <CurrencyDisplay amount={column.market} />
                  <span className="block text-xs font-normal text-muted-foreground">
                    {column.holdingCount} 檔
                  </span>
                </td>
              ))}
            </tr>
            {securitiesFields.map(renderAmountRow)}
            {hasTrust && (
              <tr>
                <th scope="row" className={ROW_HEADER}>
                  信託財產
                </th>
                {columns.map((column) => (
                  <td
                    key={column.slug}
                    className="px-3 py-2.5 text-right tabular-nums"
                  >
                    {column.amounts.trustTotal === null ? (
                      <span className="text-muted-foreground">--</span>
                    ) : (
                      <CurrencyDisplay amount={column.amounts.trustTotal} />
                    )}
                  </td>
                ))}
              </tr>
            )}
            {CANDIDATE_COUNT_FIELDS.map((field) => {
              const max = maxOf(
                columns.map((column) => column.counts[field.key])
              )
              return (
                <tr key={field.key}>
                  <th scope="row" className={ROW_HEADER}>
                    {field.label}
                  </th>
                  {columns.map((column) => {
                    const value = column.counts[field.key]
                    return (
                      <td
                        key={column.slug}
                        className={cn(
                          "px-3 py-2.5 text-right font-heading tabular-nums",
                          isMax(value, max) && "font-black"
                        )}
                      >
                        {value === null ? "--" : `${value} ${field.unit}`}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasDerived && (
        <p className="text-xs text-muted-foreground">＊ 由明細加總</p>
      )}
    </>
  )
}
