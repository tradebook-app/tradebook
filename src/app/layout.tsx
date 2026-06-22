import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Sleektrade — The Professional Trading Journal',
  description: 'Sleektrade turns your raw trade data into clear, actionable insight. Track every trade, analyze your performance, and grow your edge. Built for day traders and swing traders.',
  keywords: 'trading journal, trade tracker, day trader journal, swing trader journal, trading performance, DAS trader, trade analysis',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Sleektrade — The Professional Trading Journal',
    description: 'Know exactly why you win and lose. Sleektrade turns your raw trade data into clear, actionable insight.',
    url: 'https://sleektrade.app',
    siteName: 'Sleektrade',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sleektrade — The Professional Trading Journal',
    description: 'Know exactly why you win and lose. Sleektrade turns your raw trade data into clear, actionable insight.',
  },
  metadataBase: new URL('https://sleektrade.app'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Apply saved theme before paint to prevent flash */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          try {
            var t = localStorage.getItem('sleek-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        `}</Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
