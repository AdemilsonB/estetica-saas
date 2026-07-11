'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/public/${encodeURIComponent(slug)}/me`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<{ name: string }>) : null))
      .then((data) => {
        if (active) setName(data?.name ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [slug])

  if (!name) return null

  const styles =
    variant === 'overlay'
      ? 'border-white/60 bg-white/20 text-white ring-2 ring-white/30 backdrop-blur-sm'
      : 'border-border bg-muted text-foreground'

  return (
    <Link
      href={`/${slug}/cliente`}
      aria-label={`Meu perfil — ${name}`}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${styles}`}
    >
      {name[0]?.toUpperCase()}
    </Link>
  )
}
