import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Inter, Manrope, DM_Sans, Plus_Jakarta_Sans, Lato } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/lib/providers'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] })
const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })
const plusJakarta = Plus_Jakarta_Sans({ variable: '--font-plus-jakarta-sans', subsets: ['latin'] })
const lato = Lato({ variable: '--font-lato', subsets: ['latin'], weight: ['400', '700'] })

export const metadata: Metadata = {
  title: 'Agendê',
  description: 'Plataforma operacional inteligente para negocios de estetica e servicos.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    geistSans.variable,
    geistMono.variable,
    inter.variable,
    manrope.variable,
    dmSans.variable,
    plusJakarta.variable,
    lato.variable,
  ].join(' ')

  return (
    <html lang="pt-BR" className={`${fontVars} h-full antialiased`}>
      <head>
        <style>{`:root { --font-sans: var(--font-manrope); }`}</style>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7C3AED" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Agendê" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');})}`,
          }}
        />
      </body>
    </html>
  )
}
