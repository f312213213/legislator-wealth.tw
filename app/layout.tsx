import { Noto_Sans_TC, Noto_Serif_TC } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-sans',
})

const notoSerifTC = Noto_Serif_TC({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-serif',
})

const SITE_URL = 'https://legislator-wealth.tw'
const SITE_NAME = '立委持股公開平台'
const SITE_DESCRIPTION = '台灣第十一屆立法委員股票及基金申報資料，資料來源為監察院公報，市值依據台灣證交所收盤價估算。'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{
      url: '/og.png',
      width: 1200,
      height: 630,
      alt: SITE_NAME,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
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
      className={cn("antialiased font-sans", notoSansTC.variable, notoSerifTC.variable)}
    >
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 fade-up">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
