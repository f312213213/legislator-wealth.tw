import Link from 'next/link'
import { CurrencyDisplay } from './currency-display'
import type { LegislatorDeclaration } from '@/lib/types'

export function LegislatorCard({ data, marketTotal, rank }: { data: LegislatorDeclaration; marketTotal?: number; rank?: number }) {
  const amount = marketTotal ?? (data.securities.stocks.totalNTD + data.securities.funds.totalNTD)
  const initial = data.name.charAt(0)

  return (
    <Link href={`/legislator/${encodeURIComponent(data.name)}`} className="block bg-card transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center bg-muted text-sm font-medium text-muted-foreground">
          {initial}
          {rank && (
            <span className="rank-num absolute -top-1.5 -left-1.5 bg-foreground text-background">
              {rank}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight">{data.name}</h3>
        </div>
        <span className="text-sm font-bold tabular-nums font-mono-num">
          <CurrencyDisplay amount={amount} />
        </span>
      </div>
    </Link>
  )
}
