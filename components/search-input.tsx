'use client'

import { Input } from '@/components/ui/input'
import { RiSearchLine } from '@remixicon/react'

export function SearchInput({
  value,
  onChange,
  placeholder = '搜尋...',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  )
}
