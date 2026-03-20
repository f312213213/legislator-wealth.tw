'use client'

import { BarChart, Bar, XAxis, YAxis, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface StockChartData {
  name: string
  count: number
}

const popularityConfig = {
  count: {
    label: '持有立委數',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function StockPopularityChart({ data }: { data: StockChartData[] }) {
  return (
    <ChartContainer config={popularityConfig} className="h-[300px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 13 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

interface LegislatorValueData {
  name: string
  totalNTD: number
}

const valueConfig = {
  totalNTD: {
    label: '股票及基金市值',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function LegislatorStockValueChart({ data }: { data: LegislatorValueData[] }) {
  return (
    <ChartContainer config={valueConfig} className="h-[300px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20, top: 5, bottom: 5 }}>
        <XAxis
          type="number"
          tickFormatter={(v: number) =>
            v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`
          }
        />
        <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 13 }} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `NT$ ${new Intl.NumberFormat('zh-TW').format(Number(value))}`}
            />
          }
        />
        <Bar dataKey="totalNTD" fill="var(--color-totalNTD)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
