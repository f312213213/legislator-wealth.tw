import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-heading text-[8rem] font-black leading-none tracking-tighter sm:text-[12rem]">
        404
      </p>
      <p className="mt-2 text-lg text-muted-foreground">
        這個頁面不存在
      </p>
      <Link
        href="/"
        className="mt-8 border border-foreground px-6 py-2.5 text-sm font-bold transition-colors hover:bg-foreground hover:text-background"
      >
        回首頁
      </Link>
    </div>
  )
}
