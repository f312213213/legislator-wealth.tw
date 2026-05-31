import Link from 'next/link'

const ITEMS = [
  { href: '', label: '總覽' },
  { href: 'rankings', label: '排行榜' },
  { href: 'stocks', label: '持股總覽' },
  { href: 'changes', label: '變動紀錄' },
]

export function CouncilorCityNav({ citySlug }: { citySlug: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {ITEMS.map(item => (
        <Link
          key={item.label}
          href={`/councilor/${citySlug}${item.href ? `/${item.href}` : ''}`}
          className="inline-flex h-7 items-center border px-2.5 text-xs font-medium hover:bg-muted"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
