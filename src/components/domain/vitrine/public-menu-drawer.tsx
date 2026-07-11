'use client'

import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronRight, LogOut, Heart } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ClientHistoryModal } from './client-history-modal'
import { WhatsAppIcon } from './vitrine-icons'
import { EntityImage } from '@/components/domain/shared/entity-image'

type PublicService = {
  id: string
  name: string
  duration: number
  price: number
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  categoryName?: string | null
}

type PublicPackage = { id: string; name: string; price: number }
type PublicPromotion = {
  id: string
  name: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
}
type PublicProduct = { id: string; name: string; salePrice: number }
type TeamMember = { id: string; name: string; role: string }

type Props = {
  tenantName: string
  logoUrl?: string | null
  primaryColor: string
  phone?: string | null
  whatsappContactEnabled?: boolean
  slug: string
  bookingBaseUrl: string
  allowPublicBooking: boolean
  services: PublicService[]
  packages: PublicPackage[]
  promotions: PublicPromotion[]
  products: PublicProduct[]
  team: TeamMember[]
}

function formatPrice(s: PublicService): string {
  if (s.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (s.priceType === 'RANGE' && s.priceMin != null && s.priceMax != null)
    return `R$ ${s.priceMin.toFixed(2)}–${s.priceMax.toFixed(2)}`
  if (s.priceType === 'STARTING_FROM') return `A partir de R$ ${s.price.toFixed(2)}`
  return `R$ ${s.price.toFixed(2)}`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}` : `${h}h`
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  PROFESSIONAL: 'Profissional',
}

/* Seção genérica colapsável */
function DrawerSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold"
      >
        {title}
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

/* Sub-seção de categoria dentro de Serviços */
function CategorySubSection({
  name,
  services,
  primaryColor,
  onNavigate,
}: {
  name: string
  services: PublicService[]
  primaryColor: string
  onNavigate: (href: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mx-4 mb-1 rounded-xl border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {name}
        </span>
        <ChevronDown
          className={`size-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t bg-muted/20 pb-1">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => onNavigate(`?serviceId=${s.id}`)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{formatDuration(s.duration)}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold" style={{ color: primaryColor }}>
                {formatPrice(s)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PublicMenuDrawer({
  tenantName,
  logoUrl,
  primaryColor,
  phone,
  whatsappContactEnabled,
  slug,
  bookingBaseUrl,
  allowPublicBooking,
  services,
  packages,
  promotions,
  products,
  team,
}: Props) {
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [clientName, setClientName] = useState<string | null>(null)
  const [clientAvatar, setClientAvatar] = useState<{
    url: string | null
    cropX: number | null
    cropY: number | null
    cropZoom: number | null
  } | null>(null)
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<string[]>([])
  const [favoritePackageIds, setFavoritePackageIds] = useState<string[]>([])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-public-menu', handler)
    return () => window.removeEventListener('open-public-menu', handler)
  }, [])

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/me`, { credentials: 'include' })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{
              name: string
              avatarUrl: string | null
              avatarCropX: number | null
              avatarCropY: number | null
              avatarCropZoom: number | null
            }>)
          : null,
      )
      .then((data) => {
        setClientName(data?.name ?? null)
        setClientAvatar(
          data
            ? { url: data.avatarUrl, cropX: data.avatarCropX, cropY: data.avatarCropY, cropZoom: data.avatarCropZoom }
            : null,
        )
      })
      .catch(() => {
        setClientName(null)
        setClientAvatar(null)
      })

    fetch(`/api/public/${encodeURIComponent(slug)}/favorites`, { credentials: 'include' })
      .then((res) =>
        res.ok ? (res.json() as Promise<{ favoriteServiceIds: string[]; favoritePackageIds: string[] }>) : null,
      )
      .then((data) => {
        setFavoriteServiceIds(data?.favoriteServiceIds ?? [])
        setFavoritePackageIds(data?.favoritePackageIds ?? [])
      })
      .catch(() => {})
  }, [slug])

  const favoriteServices = services.filter((s) => favoriteServiceIds.includes(s.id))
  const favoritePackages = packages.filter((p) => favoritePackageIds.includes(p.id))

  async function handleLogout() {
    await fetch(`/api/public/${encodeURIComponent(slug)}/auth/logout`, { method: 'POST' })
    setClientName(null)
    window.location.reload()
  }

  const whatsappUrl =
    whatsappContactEnabled && phone
      ? `https://wa.me/55${phone.replace(/\D/g, '')}`
      : null

  /* Agrupa serviços por categoria */
  const categoryOrder: string[] = []
  const grouped: Record<string, PublicService[]> = {}
  for (const s of services) {
    const cat = s.categoryName ?? 'Outros'
    if (!grouped[cat]) { grouped[cat] = []; categoryOrder.push(cat) }
    grouped[cat].push(s)
  }

  const hasMultipleCategories = categoryOrder.length > 1

  function scrollTo(id: string) {
    setOpen(false)
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
  }

  function navigate(path: string) {
    // Vitrine com agendamento online desativado: leva para a lista de serviços em vez do
    // link de agendamento, evitando que o cliente caia num 404 de /agendar.
    if (!allowPublicBooking) {
      scrollTo('servicos')
      return
    }
    setOpen(false)
    setTimeout(() => { window.location.href = `${bookingBaseUrl}${path}` }, 150)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="flex-row items-center gap-3 border-b px-4 py-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={tenantName} className="size-9 rounded-xl object-contain border" />
            ) : (
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {tenantName[0]?.toUpperCase()}
              </div>
            )}
            <SheetTitle className="text-sm font-semibold leading-tight">{tenantName}</SheetTitle>
          </SheetHeader>

          {/* Identidade do cliente logado */}
          {clientName ? (
            <div
              className="mx-4 mt-3 flex items-center gap-3 rounded-2xl p-3"
              style={{ backgroundColor: `${primaryColor}14` }}
            >
              <a href={`/${slug}/cliente`} className="flex min-w-0 flex-1 items-center gap-3">
                {clientAvatar?.url ? (
                  <EntityImage
                    src={clientAvatar.url}
                    alt={clientName}
                    shape="circle"
                    cropX={clientAvatar.cropX}
                    cropY={clientAvatar.cropY}
                    cropZoom={clientAvatar.cropZoom}
                    className="size-10 shrink-0"
                    fallback={<span className="text-sm font-bold text-white">{clientName[0]?.toUpperCase()}</span>}
                  />
                ) : (
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {clientName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Olá, {clientName.split(' ')[0]}</p>
                  <p className="text-[11px] font-medium" style={{ color: primaryColor }}>
                    Ver meu perfil
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </a>
              <button
                onClick={handleLogout}
                aria-label="Sair"
                className="flex shrink-0 items-center gap-1 text-[11px] font-semibold"
                style={{ color: primaryColor }}
              >
                <LogOut className="size-3.5" />
                Sair
              </button>
            </div>
          ) : (
            <a
              href={`/${slug}/entrar`}
              className="mx-4 mt-3 flex items-center justify-center rounded-2xl p-2.5 text-xs font-semibold"
              style={{ backgroundColor: `${primaryColor}14`, color: primaryColor }}
            >
              Entrar para ver histórico e favoritos
            </a>
          )}

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto overscroll-y-contain">

            {/* Meus Favoritos */}
            {clientName && favoriteServices.length + favoritePackages.length > 0 && (
              <DrawerSection title={`Meus Favoritos (${favoriteServices.length + favoritePackages.length})`} defaultOpen={false}>
                <div className="px-4 space-y-1">
                  {favoriteServices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`?serviceId=${s.id}`)}
                      className="flex w-full items-center gap-2 rounded-lg py-2.5 text-left hover:bg-muted/50 px-2 -mx-2"
                    >
                      <Heart className="size-3.5 shrink-0" style={{ fill: '#e0436b', stroke: '#e0436b' }} />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</p>
                      <span className="shrink-0 text-xs font-semibold" style={{ color: primaryColor }}>
                        {formatPrice(s)}
                      </span>
                    </button>
                  ))}
                  {favoritePackages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`?packageId=${p.id}`)}
                      className="flex w-full items-center gap-2 rounded-lg py-2.5 text-left hover:bg-muted/50 px-2 -mx-2"
                    >
                      <Heart className="size-3.5 shrink-0" style={{ fill: '#e0436b', stroke: '#e0436b' }} />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</p>
                      <span className="shrink-0 text-xs font-semibold" style={{ color: primaryColor }}>
                        R$ {p.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </DrawerSection>
            )}

            {/* Serviços — fechado por padrão, subcategorias também fechadas */}
            {services.length > 0 && (
              <DrawerSection title={`Serviços (${services.length})`} defaultOpen={false}>
                {hasMultipleCategories ? (
                  <div className="space-y-1">
                    {categoryOrder.map((cat) => (
                      <CategorySubSection
                        key={cat}
                        name={cat}
                        services={grouped[cat]!}
                        primaryColor={primaryColor}
                        onNavigate={navigate}
                      />
                    ))}
                  </div>
                ) : (
                  /* Categoria única — lista direto */
                  <div className="px-4 space-y-1">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate(`?serviceId=${s.id}`)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg py-2.5 text-left hover:bg-muted/50 px-2 -mx-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDuration(s.duration)}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold" style={{ color: primaryColor }}>
                          {formatPrice(s)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </DrawerSection>
            )}

            {/* Pacotes */}
            {packages.length > 0 && (
              <DrawerSection title={`Pacotes (${packages.length})`} defaultOpen={false}>
                <div className="px-4 space-y-1">
                  {packages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`?packageId=${p.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg py-2.5 text-left hover:bg-muted/50 px-2 -mx-2"
                    >
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <span className="shrink-0 text-xs font-semibold" style={{ color: primaryColor }}>
                        R$ {p.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </DrawerSection>
            )}

            {/* Promoções */}
            {promotions.length > 0 && (
              <DrawerSection title={`🔥 Promoções (${promotions.length})`} defaultOpen={false}>
                <div className="px-4 space-y-1">
                  {promotions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => scrollTo('promocoes')}
                      className="flex w-full items-center justify-between gap-2 rounded-lg py-2.5 text-left hover:bg-muted/50 px-2 -mx-2"
                    >
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {p.discountType === 'PERCENTAGE'
                          ? `${p.discountValue}% OFF`
                          : `R$ ${p.discountValue.toFixed(2)} OFF`}
                      </span>
                    </button>
                  ))}
                </div>
              </DrawerSection>
            )}

            {/* Produtos */}
            {products.length > 0 && (
              <DrawerSection title={`Produtos (${products.length})`} defaultOpen={false}>
                <div className="px-4 space-y-1">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => scrollTo('produtos')}
                      className="flex w-full items-center justify-between gap-2 rounded-lg py-2.5 text-left hover:bg-muted/50 px-2 -mx-2"
                    >
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <span className="shrink-0 text-xs font-semibold" style={{ color: primaryColor }}>
                        R$ {p.salePrice.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </DrawerSection>
            )}

            {/* Equipe */}
            {team.length > 0 && (
              <DrawerSection title="Nossa Equipe" defaultOpen={false}>
                <div className="px-4 space-y-1">
                  {team.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => scrollTo('equipe')}
                      className="flex w-full items-center gap-2 rounded-lg py-2.5 text-left hover:bg-muted/50 px-2 -mx-2"
                    >
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</p>
                      </div>
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </DrawerSection>
            )}

            {/* Histórico */}
            <button
              onClick={() => { setOpen(false); setTimeout(() => setHistoryOpen(true), 150) }}
              className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-sm font-semibold hover:bg-muted/50 text-left"
            >
              <History className="size-4 text-muted-foreground" />
              Meu Histórico
            </button>
          </div>

          {/* Rodapé WhatsApp */}
          {whatsappUrl && (
            <div className="border-t p-4">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: '#25D366' }}
              >
                <WhatsAppIcon className="size-4" />
                Falar no WhatsApp
              </a>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ClientHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        slug={slug}
        primaryColor={primaryColor}
      />
    </>
  )
}
