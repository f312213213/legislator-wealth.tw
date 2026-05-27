'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CurrencyDisplay } from './currency-display'
import type { HoldingRow } from './category-tabs'

const COLORS = [
  '#4466cc', '#cc6644', '#44aa66', '#aa44aa', '#cc9944',
  '#5599cc', '#cc4466', '#66aa99', '#8866cc', '#aa8844',
]

const MAX_VISIBLE_ROWS = 5
const LOT_SIZE = 1000

interface HoldingSummary {
  key: string
  name: string
  source: 'stock' | 'fund'
  owners: string[]
  currencies: string[]
  shares: number
  value: number
  pct: number
  color: string
}

interface PortfolioSummary {
  rows: HoldingSummary[]
  totalValue: number
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

function formatLots(shares: number): string {
  const lots = shares / LOT_SIZE
  if (shares === 0) return '0 張'
  if (shares < LOT_SIZE) return `${formatNumber(shares)} 股`
  return `${formatNumber(lots)} 張`
}

function isForeignCurrency(currency: string): boolean {
  return !['新臺幣', '新台幣', '臺幣', '台幣', 'NTD', 'TWD'].includes(currency.trim().toUpperCase())
}

function isEnglishTicker(name: string): boolean {
  return /^[A-Za-z0-9.\- ]+$/.test(name.trim())
}

function usesTaiwanLots(row: HoldingSummary): boolean {
  if (row.source !== 'stock') return false
  if (row.currencies.some(isForeignCurrency)) return false
  return !isEnglishTicker(row.name)
}

function formatQuantity(row: HoldingSummary): { primary: string; secondary: string } {
  if (row.source === 'stock') {
    return {
      primary: usesTaiwanLots(row) ? formatLots(row.shares) : `${formatNumber(row.shares)} 股`,
      secondary: '',
    }
  }

  return {
    primary: `${formatNumber(row.shares)} 單位`,
    secondary: '',
  }
}

function formatPct(pct: number): string {
  if (pct <= 0) return '0%'
  if (pct < 0.01) return '<1%'
  return `${Math.round(pct * 100)}%`
}

function sourceLabel(source: HoldingSummary['source']): string {
  return source === 'stock' ? '個股' : '基金/ETF'
}

function sourceVariant(source: HoldingSummary['source']) {
  return source === 'stock' ? 'outline' as const : 'secondary' as const
}

function formatOwners(owners: string[]): string {
  if (owners.length === 0) return ''
  if (owners.length <= 2) return owners.join('、')
  return `${owners.slice(0, 2).join('、')} 等 ${owners.length} 人`
}

function buildPortfolioSummary(holdings: HoldingRow[]): PortfolioSummary {
  const grouped = new Map<string, Omit<HoldingSummary, 'pct' | 'color'>>()

  for (const holding of holdings) {
    const key = `${holding.source}:${holding.name}`
    const value = holding.marketValue ?? holding.ntdTotal
    const existing = grouped.get(key)

    if (existing) {
      existing.shares += holding.shares
      existing.value += value
      if (!existing.owners.includes(holding.owner)) {
        existing.owners.push(holding.owner)
      }
      if (holding.currency && !existing.currencies.includes(holding.currency)) {
        existing.currencies.push(holding.currency)
      }
      continue
    }

    grouped.set(key, {
      key,
      name: holding.name,
      source: holding.source,
      owners: [holding.owner],
      currencies: holding.currency ? [holding.currency] : [],
      shares: holding.shares,
      value,
    })
  }

  const totalValue = Array.from(grouped.values()).reduce((sum, row) => sum + row.value, 0)
  const rows = Array.from(grouped.values())
    .filter(row => row.shares > 0 || row.value > 0)
    .sort((a, b) => b.value - a.value || b.shares - a.shares)
    .map((row, index) => ({
      ...row,
      pct: totalValue > 0 ? row.value / totalValue : 0,
      color: COLORS[index % COLORS.length],
    }))

  return {
    rows,
    totalValue,
  }
}

export function HoldingsPie({ holdings }: { holdings: HoldingRow[] }) {
  const [showAll, setShowAll] = useState(false)

  const portfolio = useMemo(() => buildPortfolioSummary(holdings), [holdings])

  if (portfolio.rows.length === 0) return null

  const visibleRows = showAll ? portfolio.rows : portfolio.rows.slice(0, MAX_VISIBLE_ROWS)
  const hiddenRows = showAll ? [] : portfolio.rows.slice(MAX_VISIBLE_ROWS)
  const maxMetric = Math.max(...portfolio.rows.map(row => row.value), 1)
  const hiddenValue = hiddenRows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="space-y-3">
      <div className="overflow-hidden border">
        {visibleRows.map((row, index) => {
          const quantity = formatQuantity(row)
          const barWidth = Math.max(3, (row.value / maxMetric) * 100)

          return (
            <div
              key={row.key}
              className={cn(
                'border-b px-3 py-3 last:border-b-0',
                index === 0 && 'bg-muted/25'
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate text-base font-semibold">{row.name}</span>
                    <Badge variant={sourceVariant(row.source)} className="hidden shrink-0 text-xs min-[380px]:inline-flex">
                      {sourceLabel(row.source)}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate pl-9 text-xs text-muted-foreground">
                    {formatOwners(row.owners)}
                  </div>
                </div>

                <div className="shrink-0 text-right tabular-nums">
                  <div className="font-heading text-lg font-black leading-tight">{quantity.primary}</div>
                  {quantity.secondary && (
                    <div className="text-xs text-muted-foreground">{quantity.secondary}</div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 pl-9">
                <div className="h-1.5 min-w-0 flex-1 bg-muted">
                  <div
                    className="h-full"
                    style={{ width: `${barWidth}%`, backgroundColor: row.color }}
                    aria-hidden="true"
                  />
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums">
                  <div className="font-semibold">{formatPct(row.pct)}</div>
                  <div className="text-muted-foreground">
                    <CurrencyDisplay amount={row.value} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {hiddenRows.length > 0 && (
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-between gap-3 bg-muted/25 px-3 py-3 text-left transition-colors hover:bg-muted/50'
            )}
            aria-expanded={showAll}
            onClick={() => setShowAll(true)}
          >
            <div className="min-w-0">
              <div className="font-medium">其他 {hiddenRows.length} 檔</div>
              <div className="text-xs text-muted-foreground">
                <CurrencyDisplay amount={hiddenValue} /> · {formatPct(portfolio.totalValue > 0 ? hiddenValue / portfolio.totalValue : 0)}
              </div>
            </div>
            <div className="text-sm font-semibold text-foreground sm:text-right">
              展開
            </div>
          </button>
        )}
      </div>

      {showAll && portfolio.rows.length > MAX_VISIBLE_ROWS && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(false)}>
          收合至前 {MAX_VISIBLE_ROWS} 檔
        </Button>
      )}
    </div>
  )
}
