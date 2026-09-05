"use client"

import Image from "next/image"

import { AdSenseAd } from "@/components/adsense-ad"
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

export function ProductPromoDialog({
  adsenseClient,
  adsenseSlot,
}: {
  adsenseClient?: string
  adsenseSlot?: string
}) {
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

      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-5 pr-12">
          <DialogTitle className="text-base">廣告與其他產品</DialogTitle>
          <DialogDescription>
            一個維護者正在做的產品，以及一則 Google 廣告。
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="maintainer-product-title">
          <h3
            id="maintainer-product-title"
            className="px-5 pt-4 text-[10px] font-medium tracking-wider text-muted-foreground"
          >
            維護者的產品
          </h3>
          <a
            href="https://usereplier.com/?utm_source=legislator-wealth.tw&utm_medium=footer&utm_campaign=side-project"
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackProductLinkClick}
            className="group grid grid-cols-[2.5rem_1fr] gap-x-3 px-5 py-4 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <Image
              src="/products/usereplier-icon.png"
              alt=""
              width={40}
              height={40}
              className="size-10"
            />

            <span className="min-w-0">
              <span className="font-heading block text-sm font-bold">
                Replier
              </span>
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
        </section>

        {adsenseClient && adsenseSlot && (
          <section
            aria-labelledby="google-ad-title"
            className="border-t px-5 py-4"
          >
            <h3
              id="google-ad-title"
              className="mb-3 text-[10px] font-medium tracking-wider text-muted-foreground"
            >
              Google 廣告
            </h3>
            <AdSenseAd client={adsenseClient} slot={adsenseSlot} />
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
