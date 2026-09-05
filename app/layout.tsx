import { Noto_Sans_TC, Noto_Serif_TC } from "next/font/google"
import Script from "next/script"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CurrencyFormatProvider } from "@/components/currency-format-provider"
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
const SITE_NAME = '政治人物持股'
const SITE_DESCRIPTION = '台灣民意代表與地方首長持股資料入口，分類瀏覽立法委員、縣市議員與縣市首長資料。'
const GA_ID = process.env.GA_ID
const GOOGLE_ADSENSE_ACCOUNT = process.env.GOOGLE_ADSENSE_ACCOUNT

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...(GOOGLE_ADSENSE_ACCOUNT && {
    other: {
      'google-adsense-account': GOOGLE_ADSENSE_ACCOUNT,
    },
  }),
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
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', ${JSON.stringify(GA_ID)});
              `}
            </Script>
          </>
        )}
        {GOOGLE_ADSENSE_ACCOUNT && (
          <Script
            id="google-adsense"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(GOOGLE_ADSENSE_ACCOUNT)}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
        <ThemeProvider>
          <CurrencyFormatProvider>
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 fade-up">
              {children}
            </main>
            <SiteFooter />
          </CurrencyFormatProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
