'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileHeaderProps {
  logoUrl: string | null
  businessName: string
  onOpenSidebar: () => void
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

const MAIN_ROUTES = [
  '/agenda',
  '/servicos',
  '/clientes',
  '/equipe',
  '/configuracoes',
  '/dashboard',
  '/financeiro',
  '/relatorios',
  '/produtos',
  '/onboarding',
]

export function MobileHeader({ logoUrl, businessName, onOpenSidebar }: MobileHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isMainRoute = MAIN_ROUTES.some(
    r =>
      pathname === r ||
      (r !== '/clientes' && r !== '/configuracoes' && pathname.startsWith(r + '/'))
  )

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 px-4 backdrop-blur md:hidden">
      {isMainRoute ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          aria-label="Abrir menu lateral"
          className="text-muted-foreground"
        >
          <Menu className="size-5" />
        </Button>
      ) : (
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-primary"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" />
          <span className="text-sm font-medium">Voltar</span>
        </button>
      )}

      <Link
        href="/dashboard"
        className="flex items-center gap-2"
        aria-label="Ir para o Dashboard"
      >
        <span className="max-w-[140px] truncate text-sm font-semibold text-foreground">
          {businessName || 'Meu negócio'}
        </span>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={businessName}
            className="size-8 shrink-0 rounded-lg object-contain"
          />
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 text-sm font-extrabold text-white">
            A
          </div>
        )}
      </Link>
    </header>
  )
}
