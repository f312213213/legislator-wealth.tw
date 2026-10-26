"use client"

import { useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"

const STORAGE_KEY = "candidates-2026-mayor-notice-seen"
const REPORT_URL = "https://github.com/f312213213/legislator-wealth.tw/issues"
const listeners = new Set<() => void>()
// Fallback for browsers where storage is blocked, so closing still works.
let dismissed = false

function hasSeenNotice(): boolean {
  if (dismissed) return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return true
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function markNoticeSeen() {
  dismissed = true
  try {
    window.localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    // Storage blocked; the notice returns on the next visit.
  }
  listeners.forEach((listener) => listener())
}

export function CandidateDataNotice() {
  const seen = useSyncExternalStore(subscribe, hasSeenNotice, () => true)

  return (
    <Dialog
      open={!seen}
      onOpenChange={(open) => {
        if (!open) markNoticeSeen()
      }}
    >
      <DialogContent>
        <DialogTitle className="pr-6 text-sm leading-relaxed font-bold">
          <span className="inline-block">
            這是透過 AI 及人工辨識所解析的資料，
          </span>
          <span className="inline-block">
            若有錯誤請
            <a
              href={REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              回報
            </a>
            。
          </span>
        </DialogTitle>
        <DialogFooter>
          <DialogClose render={<Button />}>我知道了</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
