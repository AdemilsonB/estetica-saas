'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '/planos', label: 'Planos' },
] as const

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? 'border-slate-200 bg-white/80 shadow-sm backdrop-blur-md'
          : 'border-transparent bg-white/60 backdrop-blur-sm'
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" aria-label="Agendê — página inicial" className="shrink-0">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Agendê"
            width={550}
            height={136}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        {/* Links — visíveis apenas em desktop */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTAs — sempre visíveis (mobile e desktop) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 sm:px-4"
          >
            Entrar
          </Link>
          <Link
            href="/login?tab=signup"
            className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 transition-opacity hover:opacity-90 sm:px-4"
          >
            <span className="hidden sm:inline">Começar grátis →</span>
            <span className="sm:hidden">Grátis →</span>
          </Link>
        </div>
      </nav>
    </header>
  )
}
