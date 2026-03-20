'use client'

import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { CurrencyDisplay } from './currency-display'
import type { HoldingRow } from './category-tabs'

// Colors that work in both light and dark mode (mid-range saturation)
const COLORS = [
  '#4466cc', '#cc6644', '#44aa66', '#aa44aa', '#cc9944',
  '#5599cc', '#cc4466', '#66aa99', '#8866cc', '#aa8844',
]

interface SliceData {
  name: string
  value: number
}

function buildSlices(sorted: SliceData[], offset: number): SliceData[] {
  const visible = sorted.slice(offset)
  if (visible.length <= 8) return visible

  const top7 = visible.slice(0, 7)
  const rest = visible.slice(7)
  const restTotal = rest.reduce((s, h) => s + h.value, 0)
  return [...top7, { name: `其他 (${rest.length} 檔)`, value: restTotal }]
}

export function HoldingsPie({ holdings }: { holdings: HoldingRow[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)

  const allSorted = useMemo(() => {
    const map = new Map<string, number>()
    for (const h of holdings) {
      const value = h.marketValue ?? h.ntdTotal
      map.set(h.name, (map.get(h.name) || 0) + value)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(h => h.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [holdings])

  const data = useMemo(() => buildSlices(allSorted, offset), [allSorted, offset])
  const hasOther = data.length > 0 && data[data.length - 1].name.startsWith('其他')

  // Always use full portfolio total for percentages
  const total = allSorted.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const active = activeIndex !== null ? data[activeIndex] : null

  function handleDrillDown() {
    setOffset(prev => prev + 7)
    setActiveIndex(null)
  }

  function handleBack() {
    setOffset(prev => Math.max(0, prev - 7))
    setActiveIndex(null)
  }

  return (
    <div className="flex max-w-full flex-col items-center gap-4 sm:flex-row sm:gap-8">
      {/* Pie */}
      <div className="relative h-48 w-48 shrink-0 sm:h-56 sm:w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="90%"
              dataKey="value"
              strokeWidth={0}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(_, i) => { if (hasOther && i === data.length - 1) handleDrillDown() }}
            >
              {data.map((d, i) => (
                <Cell
                  key={`${d.name}-${i}`}
                  fill={COLORS[i % COLORS.length]}
                  opacity={activeIndex !== null && activeIndex !== i ? 0.2 : 0.7}
                  style={{
                    transition: 'opacity 0.15s ease-out',
                    cursor: hasOther && d.name.startsWith('其他') ? 'pointer' : 'default',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {active ? (
            <>
              <span className="text-xs text-muted-foreground truncate max-w-[100px] text-center">{active.name}</span>
              <span className="font-heading text-lg font-black">{Math.round((active.value / total) * 100)}%</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">總市值</span>
              <span className="font-heading text-sm font-black"><CurrencyDisplay amount={total} /></span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="w-full min-w-0 max-w-full space-y-1 overflow-hidden">
        {offset > 0 && (
          <button
            onClick={handleBack}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            ← 返回
          </button>
        )}
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100)
          const isOther = hasOther && d.name.startsWith('其他')
          return (
            <div
              key={`${d.name}-${i}`}
              className={`flex items-baseline gap-2 py-0.5 transition-opacity duration-100 ${isOther ? 'cursor-pointer' : ''}`}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1 }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => isOther && handleDrillDown()}
            >
              <span className="h-2.5 w-2.5 shrink-0 self-center" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-xs min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {d.name}
                {isOther && <span className="text-muted-foreground ml-1">展開</span>}
              </span>
              <span className="text-xs tabular-nums shrink-0 ml-auto">{pct > 0 ? `${pct}%` : '<1%'}</span>
              <span className="hidden text-xs font-bold tabular-nums shrink-0 sm:inline">
                <CurrencyDisplay amount={d.value} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
