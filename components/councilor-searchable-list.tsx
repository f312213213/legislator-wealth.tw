'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element */
import { CurrencyDisplay } from './currency-display'
import { SearchInput } from './search-input'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { RiSortAsc, RiSortDesc } from '@remixicon/react'
import type { CouncilorListItem } from '@/lib/councilor-analytics'

type SortKey = 'market' | 'declaration' | 'party' | 'title' | 'name'
type SortDirection = 'desc' | 'asc'
type StatusFilter = 'all' | 'with' | 'without'

function titleRank(title: string): number {
  if (title === '議長') return 0
  if (title === '副議長') return 1
  if (title.includes('代理')) return 2
  return 3
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'zh-TW')
}

export function CouncilorSearchableList({ councilors }: { councilors: CouncilorListItem[] }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('market')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [partyFilter, setPartyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const parties = useMemo(() => {
    const values = new Set<string>()
    for (const councilor of councilors) {
      values.add(councilor.party || '未標示')
    }
    return Array.from(values).sort(compareText)
  }, [councilors])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return councilors
      .filter(councilor => {
        const matchesSearch = !q ||
          councilor.name.toLowerCase().includes(q) ||
          councilor.party.toLowerCase().includes(q) ||
          councilor.title.toLowerCase().includes(q) ||
          councilor.city.toLowerCase().includes(q)

        if (!matchesSearch) return false
        if (partyFilter !== 'all' && (councilor.party || '未標示') !== partyFilter) return false
        if (statusFilter === 'with' && !councilor.hasDeclaration) return false
        if (statusFilter === 'without' && councilor.hasDeclaration) return false
        return true
      })
      .sort((a, b) => {
        const direction = sortDirection === 'desc' ? -1 : 1

        if (sortKey === 'market') {
          const aRank = a.rank ?? Number.POSITIVE_INFINITY
          const bRank = b.rank ?? Number.POSITIVE_INFINITY
          if (aRank !== bRank) {
            return sortDirection === 'desc' ? aRank - bRank : bRank - aRank
          }
          const byAmount = a.amount - b.amount
          if (byAmount !== 0) return byAmount * direction
          return compareText(a.name, b.name)
        }

        if (sortKey === 'declaration') {
          const withData = Number(b.hasDeclaration) - Number(a.hasDeclaration)
          if (withData !== 0) return withData
          const byDate = compareText(a.declarationDate, b.declarationDate)
          if (byDate !== 0) return byDate * direction
        }

        if (sortKey === 'party') {
          const byParty = compareText(a.party || '未標示', b.party || '未標示')
          if (byParty !== 0) return byParty * direction
        }

        if (sortKey === 'title') {
          const byTitle = titleRank(a.title) - titleRank(b.title)
          if (byTitle !== 0) return byTitle * direction
        }

        return compareText(a.name, b.name) * direction
      })
  }, [councilors, partyFilter, search, sortDirection, sortKey, statusFilter])

  return (
    <div className="space-y-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="搜尋議員姓名、黨籍或職稱..." />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select value={sortKey} onValueChange={value => setSortKey((value ?? 'market') as SortKey)}>
            <SelectTrigger className="w-full justify-between lg:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market">市值排序</SelectItem>
              <SelectItem value="declaration">申報日期</SelectItem>
              <SelectItem value="party">黨籍排序</SelectItem>
              <SelectItem value="title">職稱排序</SelectItem>
              <SelectItem value="name">姓名排序</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-center lg:w-9 lg:px-0"
            aria-label={sortDirection === 'desc' ? '切換為由小到大' : '切換為由大到小'}
            onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
          >
            {sortDirection === 'desc' ? <RiSortDesc /> : <RiSortAsc />}
            <span className="lg:hidden">{sortDirection === 'desc' ? '由高到低' : '由低到高'}</span>
          </Button>
          <Select value={partyFilter} onValueChange={value => setPartyFilter(value ?? 'all')}>
            <SelectTrigger className="w-full justify-between lg:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部黨籍</SelectItem>
              {parties.map(party => (
                <SelectItem key={party} value={party}>{party}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={value => setStatusFilter((value ?? 'all') as StatusFilter)}>
            <SelectTrigger className="w-full justify-between lg:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="with">已有申報</SelectItem>
              <SelectItem value="without">尚無申報</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        顯示 {filtered.length} / {councilors.length} 位議員
      </p>
      <div className="space-y-px">
        {filtered.map(councilor => (
          <Link
            key={councilor.slug}
            href={councilor.href}
            className="row-hover grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 bg-card px-3 py-2 hover:bg-muted/50 sm:grid-cols-[2.5rem_2.25rem_minmax(0,1fr)_auto]"
          >
            <span className="hidden text-right text-sm font-black tabular-nums text-muted-foreground/35 sm:block">
              {councilor.rank ? `#${councilor.rank}` : '--'}
            </span>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-muted text-xs font-medium text-muted-foreground">
              {councilor.avatar ? (
                <img src={councilor.avatar} alt={councilor.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                councilor.name.charAt(0)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm font-medium">{councilor.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{councilor.title}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {councilor.party || '未標示黨籍'}
                {councilor.declarationDate ? ` · 申報日 ${councilor.declarationDate}` : ''}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {councilor.hasDeclaration ? (
                <>
                  <span className="block text-sm font-bold tabular-nums tracking-tight">
                    <CurrencyDisplay amount={councilor.amount} />
                  </span>
                  <span className="block text-xs text-muted-foreground">{councilor.stockCount} 檔</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">尚無申報</span>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">查無符合條件的議員</p>
        )}
      </div>
    </div>
  )
}
