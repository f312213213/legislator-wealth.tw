import Link from 'next/link'
import { LinkButton } from '@/components/link-button'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="font-heading text-lg font-black tracking-tight">
          立委持股
        </Link>
        <nav className="flex items-center gap-1">
          <LinkButton href="/" variant="ghost" size="sm">首頁</LinkButton>
          <LinkButton href="/stocks" variant="ghost" size="sm">持股總覽</LinkButton>
          <LinkButton href="/rankings" variant="ghost" size="sm">排行榜</LinkButton>
          <LinkButton href="/changes" variant="ghost" size="sm">變動紀錄</LinkButton>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
