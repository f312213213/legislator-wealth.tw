import Link from 'next/link'
import { LinkButton } from '@/components/link-button'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="font-bold tracking-tight">
          立委持股
        </Link>
        <nav className="flex items-center gap-1">
          <LinkButton href="/" variant="ghost" size="sm">首頁</LinkButton>
          <LinkButton href="/stocks" variant="ghost" size="sm">股票總覽</LinkButton>
        </nav>
      </div>
    </header>
  )
}
