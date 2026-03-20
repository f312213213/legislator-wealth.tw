'use client'

import { useState } from 'react'

const PARTY_HEX: Record<string, string> = {
  '中國國民黨': '#000099',
  '民主進步黨': '#1B9431',
  '台灣民眾黨': '#28C8C8',
  '無黨籍': '#000000',
}

export interface StockBarData {
  name: string
  holderCount: number
  partyCounts: Record<string, number>
}

export function PartyBarChart({ stocks }: { stocks: StockBarData[] }) {
  const maxCount = stocks[0]?.holderCount || 1
  const [tooltip, setTooltip] = useState<{ color: string; x: number; y: number; stockName: string; party: string; count: number; total: number } | null>(null)

  return (
    <div className="relative space-y-1">
      {/* Tooltip — fixed position, animated */}
      <div
        className="fixed z-50 pointer-events-none transition-all duration-150 ease-out"
        style={{
          left: tooltip ? tooltip.x : 0,
          top: tooltip ? tooltip.y - 44 : 0,
          opacity: tooltip ? 1 : 0,
          transform: tooltip ? 'translateY(0)' : 'translateY(4px)',
        }}
      >
        {tooltip && (
          <div className="-translate-x-1/2 w-max bg-popover px-3 py-2 shadow-xl" style={{ borderLeft: `3px solid ${tooltip.color}` }}>
            <span className="font-heading text-lg font-black">{tooltip.count} 人</span>
            <span className="ml-1.5 text-xs text-muted-foreground">{tooltip.party}持有</span>
          </div>
        )}
      </div>

      {stocks.map(s => {
        const pct = (s.holderCount / maxCount) * 100
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
            <span className="w-14 text-right text-sm font-medium tabular-nums">{s.holderCount} 人</span>
          </div>
        )
      })}
    </div>
  )
}
