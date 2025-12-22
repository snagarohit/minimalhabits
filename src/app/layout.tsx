import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Minimal Habits',
  description: 'Track your daily habits with simplicity',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
        {/* Google Identity Services */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        {/* Google API Client */}
        <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
