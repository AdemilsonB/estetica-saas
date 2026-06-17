'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileHeaderProps {
  logoUrl: string | null
  businessName: string
  onOpenSidebar: () => void
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

export function MobileHeader({ logoUrl, businessName, onOpenSidebar }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 px-4 backdrop-blur md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSidebar}
        aria-label="Abrir menu lateral"
        className="text-muted-foreground"
      >
        <Menu className="size-5" />
      </Button>

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
          <Image
            src="/brand/logo-mark.png"
            alt="Agendê"
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg object-contain"
          />
        )}
      </Link>
    </header>
  )
}
