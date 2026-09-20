"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

type AdSenseWindow = Window & {
  adsbygoogle?: Record<string, never>[]
}

function useAdsbygoogleInit() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const adsenseWindow = window as AdSenseWindow
    adsenseWindow.adsbygoogle = adsenseWindow.adsbygoogle ?? []
    adsenseWindow.adsbygoogle.push({})
  }, [])
}

export function AdSenseAd({
  client,
  slot,
  className,
}: {
  client: string
  slot: string
  className?: string
}) {
  useAdsbygoogleInit()

  return (
    <ins
      className={cn("adsbygoogle min-h-25", className)}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

export function AdSenseInFeedAd({
  client,
  slot,
  layoutKey,
  className,
}: {
  client: string
  slot: string
  layoutKey: string
  className?: string
}) {
  useAdsbygoogleInit()

  return (
    <ins
      className={cn("adsbygoogle", className)}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="fluid"
      data-ad-layout-key={layoutKey}
    />
  )
}
