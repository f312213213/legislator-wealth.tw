'use client'

import Link from 'next/link'
import { type VariantProps } from 'class-variance-authority'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LinkButton({
  href,
  className,
  variant = 'default',
  size = 'default',
  children,
}: {
  href: string
  children: React.ReactNode
  className?: string
} & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size, className }))}>
      {children}
    </Link>
  )
}
