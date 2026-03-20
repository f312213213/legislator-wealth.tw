'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CurrencyDisplay } from './currency-display'
import { SearchInput } from './search-input'

interface LegislatorItem {
  name: string
  party: string
  avatar: string
  amount: number
  rank: number
  borderColor: string
}

export function SearchableList({ legislators }: { legislators: LegislatorItem[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return legislators
    const q = search.toLowerCase()
    return legislators.filter(l =>
      l.name.toLowerCase().includes(q) || l.party.includes(q)
    )
  }, [legislators, search])

  return (
    <div className="space-y-3">
      <SearchInput value={search} onChange={setSearch} placeholder="搜尋立委姓名或黨籍..." />
      <div className="space-y-px">
        {filtered.map(l => (
          <Link
            key={`${l.name}-${l.rank}`}
            href={`/legislator/${encodeURIComponent(l.name)}`}
            className="flex items-center gap-3 bg-card px-3 py-2 transition-colors hover:bg-muted/50"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center bg-muted text-xs font-medium text-muted-foreground overflow-hidden border-l-2 ${l.borderColor}`}>
              {l.avatar ? (
                <Image src={l.avatar} alt={l.name} width={32} height={32} className="h-full w-full object-cover" />
              ) : (
                l.name.charAt(0)
              )}
            </div>
            <span className="text-sm font-medium flex-1 min-w-0 truncate">{l.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{l.party}</span>
            <span className="text-sm font-bold tabular-nums tracking-tight shrink-0">
              {l.amount > 0 ? <CurrencyDisplay amount={l.amount} /> : <span className="text-muted-foreground font-normal">--</span>}
            </span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">查無符合條件的立委</p>
        )}
      </div>
    </div>
  )
}
