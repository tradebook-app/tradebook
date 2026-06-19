import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sleektrade — Trading Journal',
  description: 'Sleektrade — the sleek trading journal for day traders and swing traders.',
  icons: {
    icon: '/favicon.svg',
  },
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
