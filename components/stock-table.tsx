'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchInput } from './search-input'
import { CurrencyDisplay } from './currency-display'
import { formatNTD } from '@/lib/format'
import type { StockHolding, StockSource } from '@/lib/data'

const SOURCE_LABELS: Record<StockSource, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  stock: { label: '個股', variant: 'outline' },
  fund: { label: '基金/ETF', variant: 'secondary' },
}

type SortKey = 'name' | 'legislator' | 'shares' | 'ntdTotal' | 'marketValue'
type SortDir = 'asc' | 'desc'

export function StockTable({ rows }: { rows: StockHolding[] }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('ntdTotal')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [ownerFilter, setOwnerFilter] = useState<string>('全部持有人')
  const [sourceFilter, setSourceFilter] = useState<string>('全部類型')

  const filtered = useMemo(() => {
    let result = rows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.legislator.toLowerCase().includes(q)
      )
    }
    if (ownerFilter !== '全部持有人') {
      result = result.filter(r => r.owner === ownerFilter)
    }
    if (sourceFilter === '個股') {
      result = result.filter(r => r.source === 'stock')
    } else if (sourceFilter === '基金/ETF') {
      result = result.filter(r => r.source === 'fund')
    }
    result = [...result].sort((a, b) => {
      const aVal = sortKey === 'marketValue' ? (a.marketValue ?? 0) : a[sortKey]
      const bVal = sortKey === 'marketValue' ? (b.marketValue ?? 0) : b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'zh-TW') : bVal.localeCompare(aVal, 'zh-TW')
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return result
  }, [rows, search, sortKey, sortDir, ownerFilter, sourceFilter])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="輸入股票名稱或立委姓名..."
          />
        </div>
        <Select value={sourceFilter} onValueChange={v => setSourceFilter(v ?? '全部類型')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部類型">全部類型</SelectItem>
            <SelectItem value="個股">個股</SelectItem>
            <SelectItem value="基金/ETF">基金/ETF</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={v => setOwnerFilter(v ?? '全部持有人')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部持有人">全部持有人</SelectItem>
            <SelectItem value="本人">本人</SelectItem>
            <SelectItem value="配偶">配偶</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('name')}
              >
                標的名稱{sortIndicator('name')}
              </TableHead>
              <TableHead>類型</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('legislator')}
              >
                申報人{sortIndicator('legislator')}
              </TableHead>
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
                市值估算{sortIndicator('marketValue')}
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  查無符合條件的持有紀錄
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, i) => {
                const sourceInfo = SOURCE_LABELS[row.source]
                return (
                  <TableRow key={`${row.name}-${row.legislator}-${row.owner}-${i}`}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={row.name}>{row.name}</TableCell>
                    <TableCell>
                      <Badge variant={sourceInfo.variant} className="text-xs">
                        {sourceInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.legislator}</TableCell>
                    <TableCell>{row.owner}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNTD(row.shares)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.marketPrice ? `$${row.marketPrice.toLocaleString('zh-TW')}` : <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {row.marketValue ? <CurrencyDisplay amount={row.marketValue} /> : <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      <CurrencyDisplay amount={row.ntdTotal} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        共 {filtered.length} 筆持有紀錄
      </p>
    </div>
  )
}
