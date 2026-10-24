import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Shinx Merchant Cashier',
  description: 'Aplikasi kasir modern untuk bisnis kamu',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try {
            if (localStorage.getItem('shinx-theme') === 'dark') {
              document.documentElement.classList.add('dark')
            }
          } catch {}`}
        </Script>
      </head>
      <body className={geist.className}>{children}</body>
    </html>
  )
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}