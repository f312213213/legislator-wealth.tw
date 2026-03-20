import Link from 'next/link'
/* eslint-disable @next/next/no-img-element */
import { CurrencyDisplay } from './currency-display'
import type { LegislatorDeclaration } from '@/lib/types'
import type { LegislatorMeta } from '@/lib/data'

const PARTY_BORDER: Record<string, string> = {
  '中國國民黨': 'border-l-[#1a5ccc]',
  '民主進步黨': 'border-l-[#1B9431]',
  '台灣民眾黨': 'border-l-[#28C8C8]',
  '無黨籍': 'border-l-[#999999]',
}

export function LegislatorCard({ data, marketTotal, meta, slug }: { data: LegislatorDeclaration; marketTotal?: number; meta?: LegislatorMeta | null; slug?: string }) {
  const amount = marketTotal ?? (data.securities.stocks.totalNTD + data.securities.funds.totalNTD)
  const initial = data.name.charAt(0)
  const borderColor = meta?.party ? (PARTY_BORDER[meta.party] || '') : ''

  return (
    <Link href={`/legislator/${slug || encodeURIComponent(data.name)}`} className="block bg-card transition-colors hover:bg-muted/50">
      <div className={`flex items-center gap-3 px-4 py-3 border-l-3 ${borderColor}`}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-muted text-base font-medium text-muted-foreground overflow-hidden">
          {meta?.avatar ? (
            <img src={meta.avatar} alt={data.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight">{data.name}</h3>
          {meta?.party && (
            <p className="text-xs text-muted-foreground">{meta.party}</p>
          )}
        </div>
        <div className="text-right">
          <span className="text-base font-bold tabular-nums tracking-tight">
            <CurrencyDisplay amount={amount} />
          </span>
        </div>
      </div>
    </Link>
  )
}
