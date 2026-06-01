import { DataDateStatus } from "@/components/data-date-status"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl border-t px-4 pt-6 pb-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            色彩模式
          </span>
          <ThemeToggle />
        </div>
        <DataDateStatus />
      </div>
      <div className="mt-6 space-y-1 text-xs text-muted-foreground">
        <p>
          政治人物持股 - 資料來源為監察院公報與政府公開資料，本站非官方網站。
        </p>
        <p>
          <a
            href="https://github.com/f312213213/legislator-wealth.tw"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            GitHub
          </a>
          {" · "}
          Maintained by{" "}
          <a
            href="https://chiendavid.com/?utm_source=legislator-wealth.tw"
            target="_blank"
            rel="noopener"
            className="underline hover:text-foreground"
          >
            David Chien
          </a>
        </p>
      </div>
    </footer>
  )
}
