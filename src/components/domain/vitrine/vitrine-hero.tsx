'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Clock, MessageCircle, Users, AtSign, Menu } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  HAIR_SALON: 'Salão de Beleza',
  BARBERSHOP: 'Barbearia',
  NAIL_DESIGN: 'Nail Designer',
  AESTHETICS: 'Estética',
}

function businessAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const years = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000))
  const months = Math.floor(ms / (30.44 * 24 * 60 * 60 * 1000))
  if (years >= 1) return `${years} ${years === 1 ? 'ano' : 'anos'} no mercado`
  if (months >= 1) return `${months} ${months === 1 ? 'mês' : 'meses'} no mercado`
  return 'Novo no mercado'
}

type Props = {
  name: string
  bio?: string | null
  coverImageUrl?: string | null
  bannerUrl?: string | null
  logoUrl?: string | null
  segments: string[]
  address?: string | null
  createdAt: string
  primaryColor: string
  accentColor: string
  phone?: string | null
  whatsappEnabled?: boolean
  instagramUrl?: string | null
  allowPublicBooking: boolean
  bookingUrl: string
  isOpen: boolean
  teamCount: number
  hasPackages: boolean
  hasPromotions: boolean
  hasProducts: boolean
}

export function VitrineHero({
  name,
  bio,
  coverImageUrl,
  bannerUrl,
  logoUrl,
  segments,
  address,
  createdAt,
  primaryColor,
  accentColor,
  phone,
  whatsappEnabled,
  instagramUrl,
  allowPublicBooking,
  bookingUrl,
  isOpen,
  teamCount,
  hasPackages,
  hasPromotions,
  hasProducts,
}: Props) {
  const [bioExpanded, setBioExpanded] = useState(false)

  const heroImage = coverImageUrl ?? bannerUrl
  const segmentLabel = segments[0] ? (SEGMENT_LABELS[segments[0]] ?? segments[0]) : null
  const whatsappUrl =
    whatsappEnabled && phone ? `https://wa.me/55${phone.replace(/\D/g, '')}` : null
  const city = address ? address.split(',').slice(-2).join(',').trim() : null

  const anchors = [
    { id: 'servicos', label: 'Serviços', show: true },
    { id: 'pacotes', label: 'Pacotes', show: hasPackages },
    { id: 'promocoes', label: 'Promoções', show: hasPromotions },
    { id: 'equipe', label: 'Equipe', show: teamCount > 0 },
    { id: 'produtos', label: 'Produtos', show: hasProducts },
  ].filter((a) => a.show)

  function openMenu() {
    window.dispatchEvent(new CustomEvent('open-public-menu'))
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      {/* ── Banner com navegação flutuante ── */}
      <div className="relative h-56 w-full overflow-hidden sm:h-64 md:h-72">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="" className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/banner-principal.png" alt="" className="h-full w-full object-cover" />
        )}

        {/* Gradiente de legibilidade — escurece topo e base */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/45" />

        {/* ── Navegação flutuante sobre o banner ── */}
        <div className="absolute left-0 right-0 top-0 flex items-center gap-2 px-3 pt-3 sm:pt-4">
          {/* Hambúrguer */}
          <button
            onClick={openMenu}
            aria-label="Abrir menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <Menu className="size-5 text-white" />
          </button>

          {/* Logo */}
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={name}
              className="size-8 shrink-0 rounded-lg border border-white/30 object-contain shadow"
              style={{ backgroundColor: '#fff' }}
            />
          ) : (
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/30 text-xs font-bold text-white shadow"
              style={{ backgroundColor: primaryColor }}
            >
              {name[0]?.toUpperCase()}
            </div>
          )}

          {/* Nome */}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white drop-shadow">
            {name}
          </span>

          {/* Links sociais */}
          <div className="flex items-center gap-0.5">
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <AtSign className="size-4 text-white" />
              </a>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <MessageCircle className="size-4 text-white" />
              </a>
            )}
          </div>
        </div>

        {/* Badge aberto/fechado */}
        <div className="absolute bottom-3 right-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <span
              className={`size-1.5 rounded-full ${isOpen ? 'bg-green-400' : 'bg-white/50'}`}
            />
            {isOpen ? 'Aberto agora' : 'Fechado'}
          </span>
        </div>
      </div>

      {/* ── Identidade abaixo do banner ── */}
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-2">
        {/* Nome + segmento */}
        <h1 className="text-2xl font-bold leading-tight">{name}</h1>
        {(segmentLabel || city) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[segmentLabel, city].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Metadados */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" />
            {businessAge(createdAt)}
          </span>
          {address && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              <span className="line-clamp-1">{address}</span>
            </span>
          )}
          {teamCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="size-3.5 shrink-0" />
              {teamCount} {teamCount === 1 ? 'profissional' : 'profissionais'}
            </span>
          )}
        </div>

        {/* Bio */}
        {bio && (
          <div className="mt-4">
            <p
              className={`text-sm leading-relaxed text-muted-foreground ${bioExpanded ? '' : 'line-clamp-3'}`}
            >
              {bio}
            </p>
            {bio.length > 140 && (
              <button
                onClick={() => setBioExpanded((v) => !v)}
                className="mt-1 text-xs font-medium"
                style={{ color: primaryColor }}
              >
                {bioExpanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {allowPublicBooking && (
            <Link
              href={bookingUrl}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              Agendar agora
            </Link>
          )}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm font-medium"
            >
              <MessageCircle className="size-4 text-green-500" />
              WhatsApp
            </a>
          )}
        </div>

        {/* Âncoras rápidas — somente mobile */}
        {anchors.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {anchors.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-current"
                style={{ color: primaryColor }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
