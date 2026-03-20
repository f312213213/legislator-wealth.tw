'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-8 w-8" />

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="font-heading h-8 w-8 text-base font-black text-muted-foreground transition-colors hover:text-foreground"
      aria-label={resolvedTheme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
    >
      {resolvedTheme === 'dark' ? '明' : '暗'}
    </button>
  )
}
