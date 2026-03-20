'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CurrencyDisplay } from './currency-display'
import { ChangeBadge } from './change-badge'
import { formatNTD, formatDate } from '@/lib/format'
import type { ChangeDeclaration } from '@/lib/types'

export interface HoldingRow {
  name: string
  owner: string
  shares: number
  ntdTotal: number
  source: 'stock' | 'fund'
  marketPrice?: number
  marketValue?: number
}

export function CategoryTabs({
  holdings,
  changes = [],
}: {
  holdings: HoldingRow[]
  changes?: ChangeDeclaration[]
}) {
  const changeCount = changes.reduce((s, c) => s + (c.stocks?.length || 0), 0)

  return (
    <Tabs defaultValue="holdings">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="holdings">持股</TabsTrigger>
        <TabsTrigger value="changes">
          交易紀錄
          {changeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5 text-xs">
              {changeCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="holdings" className="mt-4">
        <StocksTab holdings={holdings} />
      </TabsContent>
      <TabsContent value="changes" className="mt-4">
        <ChangesTab changes={changes} />
      </TabsContent>
    </Tabs>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-muted-foreground">{message}</div>
  )
}

// ── Holdings Tab ──

type SortKey = 'name' | 'shares' | 'marketValue' | 'ntdTotal'
type SortDir = 'asc' | 'desc'

function StocksTab({ holdings }: { holdings: HoldingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('marketValue')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let aVal: number | string
      let bVal: number | string
      if (sortKey === 'marketValue') {
        aVal = a.marketValue ?? a.ntdTotal
        bVal = b.marketValue ?? b.ntdTotal
      } else if (sortKey === 'name') {
        aVal = a.name
        bVal = b.name
      } else {
        aVal = a[sortKey]
        bVal = b[sortKey]
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'zh-TW') : bVal.localeCompare(aVal, 'zh-TW')
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [holdings, sortKey, sortDir])

  const marketTotal = holdings.reduce((s, i) => s + (i.marketValue ?? i.ntdTotal), 0)

  if (holdings.length === 0) return <EmptyState message="此立委未申報股票或基金持有" />

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const sourceLabel = (s: 'stock' | 'fund') =>
    s === 'stock' ? '個股' : '基金/ETF'
  const sourceVariant = (s: 'stock' | 'fund') =>
    s === 'stock' ? 'outline' as const : 'secondary' as const

  return (
    <div className="space-y-2">
      <p className="text-sm">
        股票及基金市值：<span className="font-semibold tabular-nums"><CurrencyDisplay amount={marketTotal} /></span>
      </p>
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('name')}
              >
                名稱{sortIndicator('name')}
              </TableHead>
              <TableHead>類型</TableHead>
              <TableHead>持有人</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => toggleSort('shares')}
              >
                持有數量{sortIndicator('shares')}
              </TableHead>
              <TableHead className="text-right">現價</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => toggleSort('marketValue')}
              >
                市值{sortIndicator('marketValue')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => toggleSort('ntdTotal')}
              >
                申報金額{sortIndicator('ntdTotal')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium max-w-[200px] truncate">{s.name}</TableCell>
                <TableCell>
                  <Badge variant={sourceVariant(s.source)} className="text-xs">{sourceLabel(s.source)}</Badge>
                </TableCell>
                <TableCell>{s.owner}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNTD(s.shares)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.marketPrice ? `$${s.marketPrice.toLocaleString('zh-TW')}` : <span className="text-muted-foreground">--</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {s.marketValue ? <CurrencyDisplay amount={s.marketValue} /> : <span className="text-muted-foreground">--</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground"><CurrencyDisplay amount={s.ntdTotal} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ── Changes Tab ──

type ChangeSortKey = 'name' | 'shares' | 'total' | 'changeDate'
interface FlatRow {
  name: string; broker: string; owner: string; shares: number
  changePrice: number; total: number; changeDate: string; changeReason: string
  period: string
}

function ChangesTab({ changes }: { changes: ChangeDeclaration[] }) {
  const [sortKey, setSortKey] = useState<ChangeSortKey>('changeDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = useMemo(() => {
    const flat: FlatRow[] = []
    for (const c of changes) {
      const period = `${formatDate(c.changePeriod.from)} ~ ${formatDate(c.changePeriod.to)}`
      for (const s of c.stocks || []) {
        flat.push({ ...s, period })
      }
    }
    return flat
  }, [changes])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aVal = sortKey === 'name' ? a.name : a[sortKey]
      const bVal = sortKey === 'name' ? b.name : b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'zh-TW') : bVal.localeCompare(aVal, 'zh-TW')
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [rows, sortKey, sortDir])

  if (rows.length === 0) return <EmptyState message="此立委無交易紀錄" />

  function toggleSort(key: ChangeSortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIndicator = (key: ChangeSortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{rows.length} 筆交易</p>
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('name')}
              >
                股票{sortIndicator('name')}
              </TableHead>
              <TableHead>原因</TableHead>
              <TableHead>持有人</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => toggleSort('shares')}
              >
                股數{sortIndicator('shares')}
              </TableHead>
              <TableHead className="text-right">單價</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => toggleSort('total')}
              >
                金額{sortIndicator('total')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('changeDate')}
              >
                日期{sortIndicator('changeDate')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium max-w-[200px] truncate">{r.name}</TableCell>
                <TableCell><ChangeBadge reason={r.changeReason} /></TableCell>
                <TableCell className="text-muted-foreground">{r.owner}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNTD(r.shares)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.changePrice ? `$${r.changePrice.toLocaleString('zh-TW')}` : '--'}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  <CurrencyDisplay amount={r.total} />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatDate(r.changeDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
