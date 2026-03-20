import { Badge } from '@/components/ui/badge'

const GREEN = { variant: 'default' as const, className: 'bg-green-600 hover:bg-green-600 text-white' }
const RED = { variant: 'destructive' as const }
const BLUE = { variant: 'secondary' as const, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' }
const GRAY = { variant: 'outline' as const }

function getReasonStyle(reason: string) {
  // Green: buy / transfer in
  if (/^買|^減資轉入|^存券匯撥\(存\)/.test(reason)) return GREEN
  // Red: sell / transfer out
  if (/^賣|^減資轉出|^存券匯撥\(提\)/.test(reason)) return RED
  // Blue: corporate actions
  if (/^配股|^繼承|^贈與/.test(reason)) return BLUE
  return GRAY
}

export function ChangeBadge({ reason }: { reason: string }) {
  const style = getReasonStyle(reason)
  return (
    <Badge variant={style.variant} className={style.className}>
      {reason}
    </Badge>
  )
}
