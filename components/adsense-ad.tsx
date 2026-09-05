"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

type AdSenseWindow = Window & {
  adsbygoogle?: Record<string, never>[]
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
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return

    initialized.current = true
    const adsenseWindow = window as AdSenseWindow
    adsenseWindow.adsbygoogle = adsenseWindow.adsbygoogle ?? []
    adsenseWindow.adsbygoogle.push({})
  }, [])

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
