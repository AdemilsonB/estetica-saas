// src/components/domain/landing/legal-shell.tsx
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface LegalShellProps {
  title: string
  updatedAt: string
  children: ReactNode
}

/**
 * Casca compartilhada das páginas legais (/termos e /privacidade):
 * header com volta para a landing e corpo em prosa legível.
 */
export function LegalShell({ title, updatedAt, children }: LegalShellProps) {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/logo-mark.svg" alt="" width={512} height={512} className="h-8 w-8" />
            <span className="font-display text-lg font-extrabold text-slate-900">Agendê</span>
          </Link>
          <Link href="/" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: {updatedAt}</p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <span>© {year} Agendê · Todos os direitos reservados.</span>
          <span className="flex gap-4">
            <Link href="/termos" className="transition-colors hover:text-slate-900">Termos de Uso</Link>
            <Link href="/privacidade" className="transition-colors hover:text-slate-900">Privacidade</Link>
          </span>
        </div>
      </main>
    </div>
  )
}
