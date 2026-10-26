import { cn } from "@/lib/utils"
/* eslint-disable @next/next/no-img-element */

const PARTY_BORDER: Record<string, string> = {
  中國國民黨: "border-l-[#1a5ccc]",
  民主進步黨: "border-l-[#1B9431]",
  台灣民眾黨: "border-l-[#28C8C8]",
  無黨籍: "border-l-[#999999]",
}

const SIZES = {
  sm: "h-10 w-10 border-l-2 text-sm",
  md: "h-14 w-14 border-l-4 text-xl",
  lg: "h-20 w-20 border-l-4 text-3xl sm:h-24 sm:w-24",
}

export function CandidatePortrait({
  name,
  party,
  avatar,
  size = "md",
  lazy = false,
}: {
  name: string
  party: string | null
  avatar: string | null
  size?: keyof typeof SIZES
  lazy?: boolean
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-muted font-black text-muted-foreground",
        SIZES[size],
        (party && PARTY_BORDER[party]) || "border-l-transparent"
      )}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="h-full w-full object-cover"
          loading={lazy ? "lazy" : undefined}
        />
      ) : (
        name.charAt(0)
      )}
    </div>
  )
}
