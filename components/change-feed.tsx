'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SearchInput } from './search-input'
import { ChangeBadge } from './change-badge'
import { CurrencyDisplay } from './currency-display'
import { formatDate } from '@/lib/format'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FlatChange } from '@/lib/data'

export function ChangeFeed({ changes }: { changes: FlatChange[] }) {
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('全部原因')

  const reasons = useMemo(() => {
    const set = new Set(changes.map(c => c.changeReason))
    return Array.from(set).sort()
  }, [changes])

  const filtered = useMemo(() => {
    let result = changes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        c =>
          c.legislator.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
      )
    }
    if (reasonFilter !== '全部原因') {
      result = result.filter(c => c.changeReason === reasonFilter)
    }
    return result
  }, [changes, search, reasonFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="輸入立委姓名或股票名稱..."
          />
        </div>
        <Select value={reasonFilter} onValueChange={v => setReasonFilter(v ?? '全部原因')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部原因">全部原因</SelectItem>
            {reasons.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>立委</TableHead>
              <TableHead>股票</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>持有人</TableHead>
              <TableHead className="text-muted-foreground">日期</TableHead>
              <TableHead className="text-right">金額</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  查無符合條件的變動紀錄
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((change, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Link
                      href={`/legislator/${encodeURIComponent(change.legislator)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {change.legislator}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{change.name}</TableCell>
                  <TableCell><ChangeBadge reason={change.changeReason} /></TableCell>
                  <TableCell className="text-muted-foreground">{change.owner}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(change.changeDate)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <CurrencyDisplay amount={change.amount} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        共 {filtered.length} 筆紀錄
      </p>
    </div>
  )
}
