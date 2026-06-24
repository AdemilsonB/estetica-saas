'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, CreditCard, Building2, Settings, LogOut, BookOpen, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'

const NAV = [
  { href: '/admin',               label: 'Visão Geral',   icon: LayoutDashboard },
  { href: '/admin/planos',        label: 'Planos',        icon: CreditCard },
  { href: '/admin/tenants',       label: 'Tenants',       icon: Building2 },
  { href: '/admin/catalogo',      label: 'Catálogo',      icon: BookOpen },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

function AdminLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 text-sm font-extrabold text-white">
        A
      </div>
      <span
        className="rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
        style={{ color: '#DB2777', backgroundColor: 'rgba(219,39,119,0.15)' }}
      >
        Admin
      </span>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)
  const [logoutHovered, setLogoutHovered] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-6">
        <AdminLogo />
      </div>

      <nav className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
            style={{
              color: hoveredHref === href ? 'white' : 'rgba(255,255,255,0.5)',
              backgroundColor: hoveredHref === href ? 'rgba(124,58,237,0.4)' : 'transparent',
            }}
            onMouseEnter={() => setHoveredHref(href)}
            onMouseLeave={() => setHoveredHref(null)}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="pt-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 text-xs transition"
          style={{ color: logoutHovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
        >
          <LogOut className="size-3.5" />
          Sair da conta
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f0d1a' }}>
      {/* Header mobile — visível apenas em < md */}
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 md:hidden"
        style={{ backgroundColor: '#1a1030' }}
      >
        <AdminLogo />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menu administrativo"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <Menu className="size-5" />
        </Button>
      </header>

      <div className="flex">
        {/* Sidebar — tablet (md+) e desktop */}
        <aside
          className="sticky top-0 hidden h-screen w-52 shrink-0 md:flex"
          style={{ backgroundColor: '#1a1030' }}
        >
          <SidebarContent />
        </aside>

        <main className="min-w-0 flex-1 p-4 text-white sm:p-6 md:p-8">{children}</main>
      </div>

      {/* Menu drawer — mobile (< md) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-65 border-none p-0" style={{ backgroundColor: '#1a1030' }}>
          <SheetTitle className="sr-only">Menu administrativo</SheetTitle>
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
