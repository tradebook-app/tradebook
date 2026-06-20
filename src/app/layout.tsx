import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
