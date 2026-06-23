'use client'

import { ChevronRight } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { VitrineNextSlotBadge } from './vitrine-next-slot-badge'

export type VitrineDetailData = {
  kind: 'service' | 'package' | 'promotion'
  id: string
  name: string
  imageUrl?: string | null
  description?: string | null
  priceLabel: string
  originalPriceLabel?: string | null
  durationLabel?: string | null
  badge?: string | null
  includedNames?: string[]
  includedServiceIds?: string[]
  bookingHref: string
}

type TeamMember = { id: string; name: string; role: string; avatarUrl?: string | null }

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
}

const KIND_FALLBACK_ICON: Record<VitrineDetailData['kind'], string> = {
  service: '✂️',
  package: '📦',
  promotion: '🎉',
}

type Props = {
  data: VitrineDetailData | null
  professionals: TeamMember[]
  slug: string
  primaryColor: string
  onClose: () => void
  onSelectProfessional: (id: string) => void
}

export function VitrineDetailSheet({
  data,
  professionals,
  slug,
  primaryColor,
  onClose,
  onSelectProfessional,
}: Props) {
  return (
    <Sheet open={!!data} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-0"
      >
        {data && (
          <>
            <div className="mx-4 mt-4 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-muted">
              {data.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl">{KIND_FALLBACK_ICON[data.kind]}</span>
              )}
            </div>

            <div className="px-5 pt-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold leading-snug">{data.name}</h3>
                {data.badge && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {data.badge}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-baseline gap-2">
                {data.originalPriceLabel && (
                  <span className="text-sm text-muted-foreground line-through">{data.originalPriceLabel}</span>
                )}
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  {data.priceLabel}
                </span>
                {data.durationLabel && (
                  <span className="text-xs text-muted-foreground">· {data.durationLabel}</span>
                )}
              </div>

              {data.kind === 'service' && (
                <div className="mt-2">
                  <VitrineNextSlotBadge slug={slug} serviceId={data.id} primaryColor={primaryColor} />
                </div>
              )}

              {data.description && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.description}</p>
              )}

              {data.includedNames && data.includedNames.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.includedNames.map((n) => (
                    <span key={n} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                      {n}
                    </span>
                  ))}
                </div>
              )}

              {professionals.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Profissionais
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {professionals.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onSelectProfessional(p.id)}
                        className="flex w-full items-center gap-2.5 rounded-xl bg-muted/50 p-2 text-left"
                      >
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatarUrl} alt={p.name} className="size-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {p.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[p.role] ?? p.role}</p>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 mt-4 border-t bg-popover p-4">
              <a
                href={data.bookingHref}
                className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Agendar
              </a>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
