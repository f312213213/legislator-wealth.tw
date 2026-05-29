import { DataDateStatus } from '@/components/data-date-status'

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-2 border-t px-4 pb-10 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="space-y-1">
        <p>立委持股公開平台 - 資料來源為監察院公報，本站非官方網站。</p>
        <DataDateStatus />
        <p>
          <a
            href="https://github.com/f312213213/legislator-wealth.tw"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            GitHub
          </a>
        </p>
      </div>
      <p className="text-right">
        <span>
          Maintained by{" "}
          <a
            href="https://chiendavid.com/?utm_source=legislator-wealth.tw"
            target="_blank"
            rel="noopener"
            className="underline hover:text-foreground"
          >
            David Chien
          </a>
        </span>
      </p>
    </footer>
  )
}
