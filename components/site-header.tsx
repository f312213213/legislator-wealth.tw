"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { RiCloseLine, RiMenu3Line } from "@remixicon/react"
import { useEffect, useId, useState, type CSSProperties } from "react"
import { CurrencyFormatToggle } from "@/components/currency-format-toggle"
import { LinkButton } from "@/components/link-button"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "/legislator", label: "立法委員" },
  { href: "/councilor", label: "縣市議員" },
  { href: "/mayor", label: "縣市首長" },
  { href: "/candidates/2026-mayor", label: "候選人特輯" },
] as const

function blindDelay(index: number, open: boolean): CSSProperties {
  return { transitionDelay: open ? `${index * 55}ms` : "0ms" }
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="shrink-0 font-heading text-lg font-black tracking-tight text-nowrap"
        >
          政治人物持股
        </Link>
        <nav
          aria-label="主要導覽"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <LinkButton
              key={link.href}
              href={link.href}
              variant="ghost"
              size="sm"
            >
              {link.label}
            </LinkButton>
          ))}
          <CurrencyFormatToggle />
        </nav>
        <button
          type="button"
          aria-controls={menuId}
          aria-expanded={open}
          aria-label={open ? "關閉主選單" : "開啟主選單"}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "grid size-9 shrink-0 place-items-center border bg-background text-foreground transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none active:translate-y-px md:hidden",
            open && "bg-muted"
          )}
        >
          <span className="grid size-5 place-items-center">
            <RiMenu3Line
              className={cn(
                "col-start-1 row-start-1 size-5 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                open
                  ? "scale-75 rotate-45 opacity-0"
                  : "scale-100 rotate-0 opacity-100"
              )}
              aria-hidden="true"
            />
            <RiCloseLine
              className={cn(
                "col-start-1 row-start-1 size-5 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                open
                  ? "scale-100 rotate-0 opacity-100"
                  : "scale-75 -rotate-45 opacity-0"
              )}
              aria-hidden="true"
            />
          </span>
        </button>
      </div>
      <div
        id={menuId}
        data-state={open ? "open" : "closed"}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "absolute inset-x-0 top-full grid overflow-hidden bg-background shadow-lg transition-[grid-template-rows,opacity,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:hidden",
          open
            ? "grid-rows-[1fr] border-y border-border opacity-100"
            : "grid-rows-[0fr] border-y border-transparent opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden [perspective:900px]">
          <nav aria-label="手機主要導覽">
            {NAV_LINKS.map((link, index) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`)

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  style={blindDelay(index, open)}
                  className={cn(
                    "flex h-12 origin-top items-center justify-between border-b px-4 text-sm font-bold transition-[background-color,color,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity] [backface-visibility:hidden] hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset motion-reduce:[transform:none] motion-reduce:transition-none",
                    open
                      ? "[transform:rotateX(0)_translateY(0)] opacity-100"
                      : "[transform:rotateX(-82deg)_translateY(-8px)] opacity-0",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <span>{link.label}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-px w-6 origin-right bg-current transition-transform duration-200",
                      active ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </Link>
              )
            })}
            <div
              style={blindDelay(NAV_LINKS.length, open)}
              className={cn(
                "origin-top border-b px-4 py-3 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity] [backface-visibility:hidden] motion-reduce:[transform:none] motion-reduce:transition-none",
                open
                  ? "[transform:rotateX(0)_translateY(0)] opacity-100"
                  : "[transform:rotateX(-82deg)_translateY(-8px)] opacity-0"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  金額顯示
                </span>
                <CurrencyFormatToggle />
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
