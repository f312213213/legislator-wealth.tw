"use client"

import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (
    command: "event",
    eventName: string,
    eventParameters?: Record<string, string>
  ) => void
}

function trackEvent(eventName: string, eventParameters: Record<string, string>) {
  const analyticsWindow = window as AnalyticsWindow

  if (analyticsWindow.gtag) {
    analyticsWindow.gtag("event", eventName, eventParameters)
    return
  }

  analyticsWindow.dataLayer?.push({
    event: eventName,
    ...eventParameters,
  })
}

function trackAdButtonClick() {
  trackEvent("footer_ad_click", {
    button_text: "點我看一則廣告",
    placement: "site_footer",
    product: "Replier",
  })
}

function trackProductLinkClick() {
  trackEvent("footer_ad_product_click", {
    link_url: "https://usereplier.com/",
    placement: "site_footer_dialog",
    product: "Replier",
  })
}

export function ProductPromoDialog() {
  return (
    <Dialog>
      <DialogTrigger
        onClick={trackAdButtonClick}
        render={
          <Button
            variant="outline"
            size="sm"
            className="group w-full justify-between sm:w-auto sm:justify-center"
          />
        }
      >
        點我看一則廣告
        <span
          aria-hidden="true"
          className="transition-transform duration-150 group-hover/button:translate-x-0.5"
        >
          →
        </span>
      </DialogTrigger>

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-5 pr-12">
          <DialogTitle className="text-base">我正在做的產品</DialogTitle>
          <DialogDescription>
            不是政治獻金，只是維護者的產品廣告。
          </DialogDescription>
        </DialogHeader>

        <a
          href="https://usereplier.com/?utm_source=legislator-wealth.tw&utm_medium=footer&utm_campaign=side-project"
          target="_blank"
          rel="noopener noreferrer"
          onClick={trackProductLinkClick}
          className="group grid grid-cols-[2.5rem_1fr] gap-x-3 px-5 py-5 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <Image
            src="/products/usereplier-icon.png"
            alt=""
            width={40}
            height={40}
            className="size-10"
          />

          <span className="min-w-0">
            <span className="font-heading block text-sm font-bold">Replier</span>
            <span className="mt-1 block text-xs/relaxed text-muted-foreground">
              有人留言指定關鍵字時，自動傳送你預先寫好的私訊，並追蹤連結點擊。
            </span>
            <span className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs">
              <span className="text-muted-foreground">usereplier.com</span>
              <span className="font-medium text-foreground">
                前往網站
                <span
                  aria-hidden="true"
                  className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                >
                  ↗
                </span>
              </span>
            </span>
          </span>
        </a>
      </DialogContent>
    </Dialog>
  )
}
