'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { CurrencyDisplay } from './currency-display'

interface PartyData {
  party: string
  total: number
  count: number
  slices: { name: string; value: number }[]
  color: string
}

function shades(hex: string, count: number): string[] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return Array.from({ length: count }, (_, i) => {
    const t = 0.25 + (i / Math.max(count - 1, 1)) * 0.55
    const mix = (c: number) => Math.round(c * (1 - t) + (c > 128 ? 0 : 255) * t)
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
  })
}

export function PartyHoldingsPie({ parties }: { parties: PartyData[] }) {
  const [drillParty, setDrillParty] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const grandTotal = parties.reduce((s, p) => s + p.total, 0)
  const selected = drillParty ? parties.find(p => p.party === drillParty) : null

  // Current view data
  const data = selected
    ? selected.slices.map(s => ({ name: s.name, value: s.value }))
    : parties.map(p => ({ name: p.party, value: p.total }))
  const total = selected ? selected.total : grandTotal
  const colors = selected
    ? shades(selected.color, data.length)
    : parties.map(p => p.color)

  const active = activeIndex !== null ? data[activeIndex] : null

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
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
              onClick={(_, i) => {
                if (!selected) {
                  // Drill into party
                  setDrillParty(data[i].name)
                  setActiveIndex(null)
                }
              }}
              style={{ cursor: selected ? 'default' : 'pointer' }}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={colors[i]}
                  opacity={activeIndex !== null && activeIndex !== i ? 0.2 : 0.6}
                  style={{ transition: 'opacity 0.15s ease-out' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {active ? (
            <>
              <span className="text-xs text-muted-foreground truncate max-w-[100px] text-center">{active.name}</span>
              <span className="font-heading text-lg font-black">{Math.round((active.value / total) * 100)}%</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">{selected ? selected.party : '全部'}</span>
              <span className="font-heading text-sm font-black"><CurrencyDisplay amount={total} /></span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-full overflow-hidden space-y-1">
        {selected && (
          <button
            onClick={() => { setDrillParty(null); setActiveIndex(null) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            ← 返回全部黨派
          </button>
        )}
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          const isClickable = !selected
          const party = !selected ? parties[i] : null
          return (
            <div
              key={`${d.name}-${i}`}
              className={`flex items-center gap-2 py-0.5 transition-opacity duration-100 ${isClickable ? 'cursor-pointer' : ''}`}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1 }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => {
                if (isClickable) {
                  setDrillParty(d.name)
                  setActiveIndex(null)
                }
              }}
            >
              <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: colors[i] }} />
              <span className="text-xs font-medium min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {d.name}
                {party && <span className="text-muted-foreground ml-1">{party.count} 人</span>}
              </span>
              <span className="text-xs tabular-nums shrink-0">{pct > 0 ? `${pct}%` : '<1%'}</span>
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
