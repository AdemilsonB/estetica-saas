'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from '@/components/ui/sheet'

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

        {/* Links — desktop */}
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

        {/* CTAs — desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            Entrar
          </Link>
          <Link
            href="/login?tab=signup"
            className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 transition-opacity hover:opacity-90"
          >
            Começar grátis →
          </Link>
        </div>

        {/* Menu — mobile */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            >
              <Menu className="size-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="flex flex-col gap-1 px-4 pb-4 pt-14">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-lg px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
                  <SheetClose asChild>
                    <Link
                      href="/login"
                      className="rounded-lg border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 transition-colors hover:border-slate-300"
                    >
                      Entrar
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/login?tab=signup"
                      className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-3 text-center text-sm font-bold text-white shadow-md shadow-violet-200"
                    >
                      Começar grátis →
                    </Link>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
