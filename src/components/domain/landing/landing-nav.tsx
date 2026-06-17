// src/components/domain/landing/landing-nav.tsx
import Link from 'next/link'
import Image from 'next/image'

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="Agendê — página inicial">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Agendê"
            width={130}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="#funcionalidades" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Funcionalidades
          </Link>
          <Link href="#depoimentos" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Depoimentos
          </Link>
          <Link href="/planos" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Planos
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 hover:opacity-90 transition-opacity"
          >
            Criar conta grátis →
          </Link>
        </div>
      </nav>
    </header>
  )
}
