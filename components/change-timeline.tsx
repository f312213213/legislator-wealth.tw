import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangeBadge } from './change-badge'
import { CurrencyDisplay } from './currency-display'
import { formatDate, formatNTD } from '@/lib/format'
import type { ChangeDeclaration } from '@/lib/types'

export function ChangeTimeline({ changes }: { changes: ChangeDeclaration[] }) {
  if (changes.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        此立委無財產變動紀錄
      </div>
    )
  }

  const sorted = [...changes].sort((a, b) =>
    b.declarationDate.localeCompare(a.declarationDate)
  )

  return (
    <div className="space-y-4">
      {sorted.map((change, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {formatDate(change.declarationDate)} 變動申報
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              變動期間 {formatDate(change.changePeriod.from)} ~ {formatDate(change.changePeriod.to)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {change.stocks && change.stocks.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium">股票</h4>
                {change.stocks.map((stock, si) => (
                  <div key={si} className="flex flex-wrap items-center gap-2 border-l-2 border-border pl-3 text-sm">
                    <span className="font-medium">{stock.name}</span>
                    <ChangeBadge reason={stock.changeReason} />
                    <span className="text-muted-foreground">{stock.owner}</span>
                    <span className="tabular-nums">{formatNTD(stock.shares)} 股</span>
                    <span className="text-muted-foreground">({stock.broker})</span>
                    <span className="ml-auto font-medium tabular-nums">
                      <CurrencyDisplay amount={stock.total} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {change.notes && (
              <p className="text-sm text-muted-foreground">
                附註：{change.notes}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
