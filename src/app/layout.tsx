import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Founder OS',
  description: 'Goal-driven productivity for founders',
}

export const viewport = {
  themeColor: '#F7F5F2',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="bg-canvas text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}