import Link from 'next/link'
import Image from 'next/image'
import { CurrencyDisplay } from './currency-display'
import type { LegislatorDeclaration } from '@/lib/types'
import type { LegislatorMeta } from '@/lib/data'

const PARTY_BG: Record<string, string> = {
  '國民黨': 'bg-[#000099]/15 hover:bg-[#000099]/25',
  '民進黨': 'bg-[#1B9431]/15 hover:bg-[#1B9431]/25',
  '民眾黨': 'bg-[#28C8C8]/15 hover:bg-[#28C8C8]/25',
  '無黨籍': 'bg-[#888888]/10 hover:bg-[#888888]/20',
}

export function LegislatorCard({ data, marketTotal, meta }: { data: LegislatorDeclaration; marketTotal?: number; meta?: LegislatorMeta | null }) {
  const amount = marketTotal ?? (data.securities.stocks.totalNTD + data.securities.funds.totalNTD)
  const initial = data.name.charAt(0)
  const partyBg = meta?.party ? (PARTY_BG[meta.party] || 'bg-card hover:bg-muted/50') : 'bg-card hover:bg-muted/50'

  return (
    <Link href={`/legislator/${encodeURIComponent(data.name)}`} className={`block transition-colors ${partyBg}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted text-sm font-medium text-muted-foreground overflow-hidden">
          {meta?.avatar ? (
            <Image src={meta.avatar} alt={data.name} width={40} height={40} className="h-full w-full object-cover" />
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
        <span className="text-sm font-bold tabular-nums font-mono-num">
          <CurrencyDisplay amount={amount} />
        </span>
      </div>
    </Link>
  )
}
