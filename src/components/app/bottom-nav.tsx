'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Calendar, Scissors, Plus, Users, LogOut, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { usePermissions } from '@/hooks/use-permissions'
import { useBillingStatus } from '@/hooks/billing/use-billing-status'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { EntityImage } from '@/components/domain/shared/entity-image'

const NAV_ITEMS = [
  { icon: Calendar, label: 'Agenda', href: '/agenda' },
  { icon: Scissors, label: 'Serviços', href: '/servicos' },
  null,
  { icon: Users, label: 'Clientes', href: '/clientes' },
] as const

interface BottomNavProps {
  onNewAppointment: () => void
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

export function BottomNav({ onNewAppointment }: BottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = usePermissions()
  const { data: billingStatus } = useBillingStatus()
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const plan = billingStatus?.plan ?? null

  return (
    <>
      <nav
        aria-label="Navegação principal mobile"
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-background md:hidden"
        style={{
          height: 'calc(72px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.10), 0 -1px 0 rgba(0,0,0,0.04)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          if (item === null) {
            return (
              <button
                key="fab"
                onClick={onNewAppointment}
                aria-label="Novo agendamento"
                className="-mt-4 flex size-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 text-primary-foreground transition hover:opacity-90 active:scale-95"
              >
                <Plus className="size-6" />
              </button>
            )
          }
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground',
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ background: 'linear-gradient(to right, #7C3AED, #DB2777)' }}
                />
              )}
              <Icon
                className={cn('size-6', isActive && 'fill-primary/10')}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Botão Perfil */}
        <button
          onClick={() => setProfileOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-2"
          aria-label="Abrir perfil"
        >
          {plan && (
            <span className="text-[8px] font-bold uppercase tracking-wide text-primary leading-none mb-0.5">
              {plan}
            </span>
          )}
          <EntityImage
            src={user?.avatarUrl}
            alt={user?.name ?? 'Perfil'}
            shape="circle"
            cropX={user?.avatarCropX}
            cropY={user?.avatarCropY}
            cropZoom={user?.avatarCropZoom}
            className="size-7 border border-primary/20"
            fallback={
              <div className="flex size-full items-center justify-center bg-primary/15 text-[10px] font-bold text-primary">
                {getInitials(user?.name ?? 'U')}
              </div>
            }
          />
          <span className="text-[11px] font-medium text-muted-foreground">Perfil</span>
        </button>
      </nav>

      {/* Sheet de perfil */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetTitle className="sr-only">Perfil</SheetTitle>
          <div className="space-y-1 pb-2">
            {/* Cabeçalho do usuário */}
            <div className="flex items-center gap-3 px-2 py-3">
              <EntityImage
                src={user?.avatarUrl}
                alt={user?.name ?? 'Perfil'}
                shape="circle"
                cropX={user?.avatarCropX}
                cropY={user?.avatarCropY}
                cropZoom={user?.avatarCropZoom}
                className="size-11 rounded-xl"
                fallback={
                  <div className="flex size-full items-center justify-center bg-primary/15 text-sm font-bold text-primary">
                    {getInitials(user?.name ?? 'U')}
                  </div>
                }
              />
              <div>
                <p className="text-sm font-semibold text-foreground">{user?.name ?? '—'}</p>
                {plan && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">{plan}</span>
                )}
              </div>
            </div>

            <Link
              href="/equipe"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-3 rounded-xl px-2 py-3 text-sm font-medium text-foreground hover:bg-accent/60 transition"
            >
              <Users className="size-4 text-muted-foreground" />
              Minha equipe
            </Link>

            <Link
              href="/configuracoes"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-3 rounded-xl px-2 py-3 text-sm font-medium text-foreground hover:bg-accent/60 transition"
            >
              <Settings className="size-4 text-muted-foreground" />
              Configurações
            </Link>

            <div className="pt-2 border-t border-border/50">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition"
              >
                <LogOut className="size-4" />
                Sair da conta
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
