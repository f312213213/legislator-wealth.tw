'use client'

import { useState } from 'react'

const PARTY_HEX: Record<string, string> = {
  '中國國民黨': '#1a5ccc',
  '民主進步黨': '#1B9431',
  '台灣民眾黨': '#28C8C8',
  '無黨籍': '#000000',
}

export interface StockBarData {
  name: string
  holderCount: number
  totalShares: number
  marketValue: number
  partyCounts: Record<string, number>
}

type SortKey = 'holderCount' | 'totalShares' | 'marketValue'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'holderCount', label: '持有人數' },
  { key: 'totalShares', label: '持股張數' },
  { key: 'marketValue', label: '持有市值' },
]

const TOP_N_OPTIONS = [10, 50, 100]

function formatMetric(s: StockBarData, key: SortKey): string {
  if (key === 'holderCount') return `${s.holderCount} 人`
  if (key === 'totalShares') return `${(s.totalShares / 1000).toLocaleString('zh-TW', { maximumFractionDigits: 0 })} 張`
  const val = s.marketValue
  if (val >= 100_000_000) return `${(val / 100_000_000).toFixed(1)} 億`
  if (val >= 10_000) return `${Math.round(val / 10_000).toLocaleString('zh-TW')} 萬`
  return `${val.toLocaleString('zh-TW')}`
}

export function PartyBarChart({ stocks }: { stocks: StockBarData[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('holderCount')
  const [topN, setTopN] = useState(10)
  const [tooltip, setTooltip] = useState<{ color: string; x: number; y: number; stockName: string; party: string; count: number; total: number } | null>(null)

  const sorted = [...stocks].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, topN)
  const maxValue = sorted[0]?.[sortKey] || 1

  return (
    <div className="relative space-y-3">
      {/* Sort toggle + topN selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {SORT_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setSortKey(o.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                sortKey === o.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <select
          value={topN}
          onChange={e => setTopN(Number(e.target.value))}
          className="ml-auto text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
        >
          {TOP_N_OPTIONS.map(n => (
            <option key={n} value={n}>前 {n}</option>
          ))}
        </select>
      </div>

      {/* Tooltip — fixed position, animated */}
      <div
        className="fixed z-50 pointer-events-none transition-opacity duration-100"
        style={{
          left: tooltip ? tooltip.x : 0,
          top: tooltip ? tooltip.y - 44 : 0,
          opacity: tooltip ? 1 : 0,
        }}
      >
        {tooltip && (
          <div className="-translate-x-1/2 w-max bg-popover px-3 py-2 shadow-xl" style={{ borderLeft: `3px solid ${tooltip.color}` }}>
            <span className="font-heading text-lg font-black">{tooltip.count} 人</span>
            <span className="ml-1.5 text-xs text-muted-foreground">{tooltip.party}持有</span>
          </div>
        )}
      </div>

      {sorted.map(s => {
        const pct = (s[sortKey] / maxValue) * 100
        const total = s.holderCount
        const parties = Object.entries(s.partyCounts).sort((a, b) => b[1] - a[1])
        return (
          <div key={s.name} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm font-medium truncate">{s.name}</span>
            <div className="flex-1 h-6 bg-muted overflow-hidden" style={{ width: `${pct}%` }}>
              <div className="flex h-full">
                {parties.map(([party, count]) => {
                  const color = PARTY_HEX[party] || '#999'
                  return (
                    <div
                      key={party}
                      className="h-full transition-opacity duration-100"
                      style={{
                        width: `${(count / total) * 100}%`,
                        backgroundColor: color,
                        opacity: tooltip
                          ? (tooltip.stockName === s.name && tooltip.party === party ? 0.6 : 0.15)
                          : 0.5,
                      }}
                      onMouseMove={e => {
                        setTooltip({
                          color,
                          x: e.clientX,
                          y: e.clientY - 8,
                          stockName: s.name,
                          party,
                          count,
                          total,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </div>
            </div>
            <span className="w-20 text-right text-sm font-medium tabular-nums">{formatMetric(s, sortKey)}</span>
          </div>
        )
      })}
    </div>
  )
}
