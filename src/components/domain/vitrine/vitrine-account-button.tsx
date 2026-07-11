'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EntityImage } from '@/components/domain/shared/entity-image'

type Me = {
  name: string
  avatarUrl: string | null
  avatarCropX: number | null
  avatarCropY: number | null
  avatarCropZoom: number | null
}

type Props = {
  slug: string
  /** 'overlay' = sobre o banner (fundo translúcido claro); 'plain' = header sem banner. */
  variant: 'overlay' | 'plain'
}

/**
 * Atalho sempre visível no topo da vitrine para o cliente logado acessar o próprio perfil.
 * Enquanto não identificado, não renderiza nada (o acesso "Entrar" fica no menu lateral).
 */
export function VitrineAccountButton({ slug, variant }: Props) {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/public/${encodeURIComponent(slug)}/me`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<Me>) : null))
      .then((data) => {
        if (active) setMe(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [slug])

  if (!me?.name) return null

  const ring = variant === 'overlay' ? 'border-white/60 ring-2 ring-white/30' : 'border-border'

  return (
    <Link
      href={`/${slug}/cliente`}
      aria-label={`Meu perfil — ${me.name}`}
      className="shrink-0"
    >
      <EntityImage
        src={me.avatarUrl}
        alt={me.name}
        shape="circle"
        cropX={me.avatarCropX}
        cropY={me.avatarCropY}
        cropZoom={me.avatarCropZoom}
        className={`size-9 border ${ring}`}
        fallback={<span className="text-xs font-bold">{me.name[0]?.toUpperCase()}</span>}
      />
    </Link>
  )
}
