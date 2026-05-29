'use client'

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'

export type CurrencyFormat = 'plain' | 'taiwanese'

const STORAGE_KEY = 'currency-format'
const listeners = new Set<() => void>()

const CurrencyFormatContext = createContext<{
  format: CurrencyFormat
  setFormat: (format: CurrencyFormat) => void
}>({
  format: 'plain',
  setFormat: () => {},
})

function isCurrencyFormat(value: string | null): value is CurrencyFormat {
  return value === 'plain' || value === 'taiwanese'
}

function getStoredFormat(): CurrencyFormat {
  if (typeof window === 'undefined') return 'plain'

  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isCurrencyFormat(stored) ? stored : 'plain'
}

function getServerFormat(): CurrencyFormat {
  return 'plain'
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) listener()
  }

  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function CurrencyFormatProvider({ children }: { children: React.ReactNode }) {
  const format = useSyncExternalStore(subscribe, getStoredFormat, getServerFormat)

  const setFormat = useCallback((nextFormat: CurrencyFormat) => {
    window.localStorage.setItem(STORAGE_KEY, nextFormat)
    listeners.forEach(listener => listener())
  }, [])

  const value = useMemo(() => ({ format, setFormat }), [format, setFormat])

  return (
    <CurrencyFormatContext.Provider value={value}>
      {children}
    </CurrencyFormatContext.Provider>
  )
}

export function useCurrencyFormat() {
  return useContext(CurrencyFormatContext)
}
