import Link from 'next/link'
import { LayoutDashboard, CreditCard, Building2, ArrowLeft } from 'lucide-react'

const NAV = [
  { href: '/admin',         label: 'Visão Geral',  icon: LayoutDashboard },
  { href: '/admin/planos',  label: 'Planos',       icon: CreditCard },
  { href: '/admin/tenants', label: 'Tenants',      icon: Building2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-red-600 px-4 py-1.5 text-center text-xs font-medium text-white">
        Modo Administrador — você está gerenciando o sistema
      </div>
      <div className="flex">
        <aside className="sticky top-0 h-screen w-52 shrink-0 border-r border-slate-200 bg-white p-4">
          <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Admin</p>
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="pt-6">
            <Link
              href="/agenda"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-700"
            >
              <ArrowLeft className="size-3.5" />
              Voltar ao meu negócio
            </Link>
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
