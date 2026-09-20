'use client'

import { Fragment, useState, useMemo } from 'react'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element */
import { CurrencyDisplay } from './currency-display'
import { SearchInput } from './search-input'
import { AdSenseInFeedAd } from './adsense-ad'
import { AD_INSERT_AFTER_INDEX, shouldShowInFeedAd, type InFeedAdConfig } from '@/lib/adsense'

interface LegislatorItem {
  name: string
  slug: string
  party: string
  avatar: string
  amount: number
  rank: number
  borderColor: string
}

export function SearchableList({
  legislators,
  inFeedAd,
}: {
  legislators: LegislatorItem[]
  inFeedAd?: InFeedAdConfig
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return legislators
    const q = search.toLowerCase()
    return legislators.filter(l =>
      l.name.toLowerCase().includes(q) || l.party.includes(q)
    )
  }, [legislators, search])

  const showAd = shouldShowInFeedAd(inFeedAd, filtered.length)

  return (
    <div className="space-y-3">
      <SearchInput value={search} onChange={setSearch} placeholder="搜尋立委姓名或黨籍..." />
      <div className="space-y-px">
        {filtered.map((l, i) => (
          <Fragment key={`${l.name}-${l.rank}`}>
            <Link
              href={`/legislator/${l.slug}`}
              className="row-hover flex items-center gap-3 bg-card px-3 py-2 hover:bg-muted/50"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center bg-muted text-xs font-medium text-muted-foreground overflow-hidden border-l-2 ${l.borderColor}`}>
                {l.avatar ? (
                  <img src={l.avatar} alt={l.name} className="h-full w-full object-cover" />
                ) : (
                  l.name.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{l.name}</p>
                <p className="text-xs text-muted-foreground truncate">{l.party || '未標示黨籍'}</p>
              </div>
              <span className="text-sm font-bold tabular-nums tracking-tight shrink-0">
                {l.amount > 0 ? <CurrencyDisplay amount={l.amount} /> : <span className="text-muted-foreground font-normal">--</span>}
              </span>
            </Link>
            {showAd && i === AD_INSERT_AFTER_INDEX && (
              <AdSenseInFeedAd
                client={inFeedAd.client}
                slot={inFeedAd.slot}
                layoutKey={inFeedAd.layoutKey}
              />
            )}
          </Fragment>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">查無符合條件的立委</p>
        )}
      </div>
    </div>
  )
}
