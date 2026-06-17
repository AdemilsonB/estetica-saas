'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Clock, MessageCircle, Users } from 'lucide-react'

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
  allowPublicBooking: boolean
  bookingUrl: string
  isOpen: boolean
  teamCount: number
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
  allowPublicBooking,
  bookingUrl,
  isOpen,
  teamCount,
}: Props) {
  const [bioExpanded, setBioExpanded] = useState(false)

  const heroImage = coverImageUrl ?? bannerUrl
  const segmentLabel = segments[0] ? (SEGMENT_LABELS[segments[0]] ?? segments[0]) : null
  const whatsappUrl =
    whatsappEnabled && phone
      ? `https://wa.me/55${phone.replace(/\D/g, '')}`
      : null

  const city = address
    ? address.split(',').slice(-2).join(',').trim()
    : null

  return (
    <div>
      {/* Banner */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/7' }}>
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Badge aberto/fechado sobre o banner */}
        <div className="absolute bottom-3 right-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
          >
            <span className={`size-1.5 rounded-full ${isOpen ? 'bg-green-400' : 'bg-white/50'}`} />
            {isOpen ? 'Aberto agora' : 'Fechado'}
          </span>
        </div>
      </div>

      {/* Identidade */}
      <div className="mx-auto max-w-3xl px-4">
        {/* Logo sobrepõe o banner */}
        <div className="-mt-9 mb-3 flex items-end gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={name}
              className="size-[72px] shrink-0 rounded-2xl border-4 border-white object-contain shadow-md"
              style={{ backgroundColor: '#fff' }}
            />
          ) : (
            <div
              className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl border-4 border-white text-2xl font-bold text-white shadow-md"
              style={{ backgroundColor: primaryColor }}
            >
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Nome + segmento */}
        <h1 className="text-xl font-bold leading-tight">{name}</h1>
        {(segmentLabel || city) && (
          <p className="mt-0.5 text-sm text-muted-foreground">
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

        {/* Âncoras rápidas */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['servicos', 'pacotes', 'promocoes', 'equipe', 'produtos'] as const).map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors hover:border-transparent hover:text-white"
              style={{ ['--hover-bg' as string]: primaryColor }}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {id === 'servicos' ? 'Serviços' : id === 'promocoes' ? 'Promoções' : id.charAt(0).toUpperCase() + id.slice(1)}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
