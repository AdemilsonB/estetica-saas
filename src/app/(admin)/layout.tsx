import Link from 'next/link'
import { LayoutDashboard, CreditCard, Building2, Settings, ArrowLeft, BookOpen } from 'lucide-react'

const NAV = [
  { href: '/admin',               label: 'Visão Geral',   icon: LayoutDashboard },
  { href: '/admin/planos',        label: 'Planos',        icon: CreditCard },
  { href: '/admin/tenants',       label: 'Tenants',       icon: Building2 },
  { href: '/admin/catalogo',      label: 'Catálogo',      icon: BookOpen },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0f0d1a' }}>
      <aside
        className="sticky top-0 flex h-screen w-52 shrink-0 flex-col p-4"
        style={{ backgroundColor: '#1a1030' }}
      >
        {/* Logo + badge ADMIN */}
        <div className="mb-6 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-mark.png"
            alt="Agendê"
            className="size-8 rounded-lg object-contain"
          />
          <span
            className="rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ color: '#DB2777', backgroundColor: 'rgba(219,39,119,0.15)' }}
          >
            Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.4)'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              }}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="pt-4">
          <Link
            href="/agenda"
            className="flex items-center gap-2 text-xs transition"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          >
            <ArrowLeft className="size-3.5" />
            Voltar ao meu negócio
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-8 text-white">{children}</main>
    </div>
  )
}
