"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type AdSenseWindow = Window & {
  adsbygoogle?: Record<string, never>[]
}

function pushAdsbygoogle() {
  const win = window as AdSenseWindow
  win.adsbygoogle = win.adsbygoogle ?? []
  win.adsbygoogle.push({})
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
    pushAdsbygoogle()
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

type AdStatus = "pending" | "filled" | "unfilled"

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
  const insRef = useRef<HTMLModElement>(null)
  const initialized = useRef(false)
  const [status, setStatus] = useState<AdStatus>("pending")

  useEffect(() => {
    if (initialized.current || !insRef.current) return
    initialized.current = true
    pushAdsbygoogle()

    const ins = insRef.current
    const readStatus = () => {
      const attr = ins.getAttribute("data-ad-status")
      if (attr === "filled" || attr === "unfilled") setStatus(attr)
    }
    readStatus()
    const observer = new MutationObserver(readStatus)
    observer.observe(ins, {
      attributes: true,
      attributeFilter: ["data-ad-status"],
    })
    return () => observer.disconnect()
  }, [])

  if (status === "unfilled") return null

  return (
    <ins
      ref={insRef}
      className={cn("adsbygoogle block min-h-[50px]", className)}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="fluid"
      data-ad-layout-key={layoutKey}
    />
  )
}
