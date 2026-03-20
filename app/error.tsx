'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-heading text-[8rem] font-black leading-none tracking-tighter text-destructive/20 sm:text-[12rem]">
        500
      </p>
      <p className="mt-2 text-lg text-muted-foreground">
        發生了一些問題
      </p>
      <button
        onClick={reset}
        className="mt-8 border border-foreground px-6 py-2.5 text-sm font-bold transition-colors hover:bg-foreground hover:text-background"
      >
        重新載入
      </button>
    </div>
  )
}
