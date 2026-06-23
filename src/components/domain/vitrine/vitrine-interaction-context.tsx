'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { VitrineDetailSheet, type VitrineDetailData } from './vitrine-detail-sheet'
import { VitrineProfessionalSheet } from './vitrine-professional-sheet'

type TeamMember = {
  id: string
  name: string
  role: string
  avatarUrl?: string | null
  bio?: string | null
  serviceIds?: string[]
}
type ServiceLite = { id: string; name: string }
type FavoriteKind = 'service' | 'package'

type ContextValue = {
  openDetail: (data: VitrineDetailData) => void
  openProfessional: (professionalId: string) => void
  isFavorited: (kind: FavoriteKind, itemId: string) => boolean
  toggleFavorite: (kind: FavoriteKind, itemId: string) => void
}

const VitrineInteractionContext = createContext<ContextValue | null>(null)

export function useVitrineInteraction(): ContextValue {
  const ctx = useContext(VitrineInteractionContext)
  if (!ctx) throw new Error('useVitrineInteraction deve ser usado dentro de VitrineInteractionProvider')
  return ctx
}

type Props = {
  slug: string
  primaryColor: string
  bookingBaseUrl: string
  team: TeamMember[]
  services: ServiceLite[]
  children: ReactNode
}

export function VitrineInteractionProvider({
  slug,
  primaryColor,
  bookingBaseUrl,
  team,
  services,
  children,
}: Props) {
  const [detail, setDetail] = useState<VitrineDetailData | null>(null)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<Set<string>>(new Set())
  const [favoritePackageIds, setFavoritePackageIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/favorites`, { credentials: 'include' })
      .then((res) =>
        res.ok ? (res.json() as Promise<{ favoriteServiceIds: string[]; favoritePackageIds: string[] }>) : null,
      )
      .then((data) => {
        if (!data) return
        setFavoriteServiceIds(new Set(data.favoriteServiceIds))
        setFavoritePackageIds(new Set(data.favoritePackageIds))
      })
      .catch(() => {})
  }, [slug])

  function isFavorited(kind: FavoriteKind, itemId: string): boolean {
    return kind === 'service' ? favoriteServiceIds.has(itemId) : favoritePackageIds.has(itemId)
  }

  function toggleFavorite(kind: FavoriteKind, itemId: string) {
    const set = kind === 'service' ? favoriteServiceIds : favoritePackageIds
    const setter = kind === 'service' ? setFavoriteServiceIds : setFavoritePackageIds
    const wasFavorited = set.has(itemId)

    const optimistic = new Set(set)
    if (wasFavorited) optimistic.delete(itemId)
    else optimistic.add(itemId)
    setter(optimistic)

    fetch(`/api/public/${encodeURIComponent(slug)}/favorites`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, itemId }),
    }).then((res) => {
      if (res.status === 401) {
        setter(set)
        window.location.href = `/${slug}/entrar`
        return
      }
      if (!res.ok) setter(set)
    }).catch(() => setter(set))
  }

  const serviceNameById = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services])
  const teamById = useMemo(() => new Map(team.map((m) => [m.id, m])), [team])

  const professionals = useMemo(() => {
    if (!detail) return []
    const relevantServiceIds = detail.kind === 'service' ? [detail.id] : detail.includedServiceIds ?? []
    if (relevantServiceIds.length === 0) return []
    return team.filter((m) => m.serviceIds?.some((id) => relevantServiceIds.includes(id)))
  }, [detail, team])

  const selectedProfessional = useMemo(() => {
    if (!professionalId) return null
    const m = teamById.get(professionalId)
    if (!m) return null
    return {
      ...m,
      specialtyNames: (m.serviceIds ?? [])
        .map((id) => serviceNameById.get(id))
        .filter((n): n is string => !!n),
    }
  }, [professionalId, teamById, serviceNameById])

  return (
    <VitrineInteractionContext.Provider
      value={{ openDetail: setDetail, openProfessional: setProfessionalId, isFavorited, toggleFavorite }}
    >
      {children}
      <VitrineDetailSheet
        data={detail}
        professionals={professionals}
        slug={slug}
        primaryColor={primaryColor}
        onClose={() => setDetail(null)}
        onSelectProfessional={setProfessionalId}
      />
      <VitrineProfessionalSheet
        professional={selectedProfessional}
        primaryColor={primaryColor}
        bookingBaseUrl={bookingBaseUrl}
        onClose={() => setProfessionalId(null)}
      />
    </VitrineInteractionContext.Provider>
  )
}
