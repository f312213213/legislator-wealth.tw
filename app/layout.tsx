import { Noto_Sans_TC } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
})

export const metadata = {
  title: '立委持股公開平台',
  description: '台灣立法委員股票及基金申報資料公開透明平台，資料來源：監察院公報',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={cn("antialiased font-sans", notoSansTC.variable)}
    >
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
