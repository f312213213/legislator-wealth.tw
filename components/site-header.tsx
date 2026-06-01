import Link from "next/link"
import { CurrencyFormatToggle } from "@/components/currency-format-toggle"
import { LinkButton } from "@/components/link-button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-heading text-lg font-black tracking-tight text-nowrap"
        >
          政治人物持股
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <LinkButton href="/legislator" variant="ghost" size="sm">
            立法委員
          </LinkButton>
          <LinkButton href="/councilor" variant="ghost" size="sm">
            縣市議員
          </LinkButton>
          <LinkButton href="/mayor" variant="ghost" size="sm">
            縣市首長
          </LinkButton>
          <CurrencyFormatToggle />
        </nav>
      </div>
    </header>
  )
}
