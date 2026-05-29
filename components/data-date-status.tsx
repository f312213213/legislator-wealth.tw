import { getIndex, getLatestDeclarationDate } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

function formatIndexUpdatedDate(dateStr: string): string {
  return formatDate(dateStr.slice(0, 10))
}

export function DataDateStatus({ className }: { className?: string }) {
  const index = getIndex()
  const latestDeclarationDate = getLatestDeclarationDate()
  const updatedDate = formatIndexUpdatedDate(index.lastUpdated)

  return (
    <dl className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      {latestDeclarationDate && (
        <div className="flex items-center gap-1.5">
          <dt>最新申報日</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatDate(latestDeclarationDate)}</dd>
        </div>
      )}
      {updatedDate && (
        <div className="flex items-center gap-1.5">
          <dt>資料更新</dt>
          <dd className="font-medium tabular-nums text-foreground">{updatedDate}</dd>
        </div>
      )}
    </dl>
  )
}
