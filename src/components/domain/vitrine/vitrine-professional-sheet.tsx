'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { EntityImage } from '@/components/domain/shared/entity-image'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
}

export type ResolvedProfessional = {
  id: string
  name: string
  role: string
  avatarUrl?: string | null
  avatarCropX?: number | null
  avatarCropY?: number | null
  avatarCropZoom?: number | null
  bio?: string | null
  specialtyNames: string[]
}

type Props = {
  professional: ResolvedProfessional | null
  primaryColor: string
  bookingBaseUrl: string
  allowPublicBooking: boolean
  onClose: () => void
}

export function VitrineProfessionalSheet({
  professional,
  primaryColor,
  bookingBaseUrl,
  allowPublicBooking,
  onClose,
}: Props) {
  return (
    <Sheet open={!!professional} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-0"
      >
        {professional && (
          <>
            <div
              className="mx-4 mt-4 h-20 rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, #A855F7)` }}
            />
            <div className="-mt-7 px-5">
              <EntityImage
                src={professional.avatarUrl}
                alt={professional.name}
                shape="circle"
                cropX={professional.avatarCropX}
                cropY={professional.avatarCropY}
                cropZoom={professional.avatarCropZoom}
                className="size-16 border-4 border-popover"
                fallback={
                  <div
                    className="flex size-full items-center justify-center text-xl font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {professional.name[0]?.toUpperCase()}
                  </div>
                }
              />
              <h3 className="mt-2 text-base font-bold">{professional.name}</h3>
              <span
                className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}
              >
                {ROLE_LABELS[professional.role] ?? professional.role}
              </span>

              {professional.bio && (
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {professional.bio}
                </p>
              )}

              {professional.specialtyNames.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Serviços
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {professional.specialtyNames.map((n) => (
                      <span
                        key={n}
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {allowPublicBooking && (
              <div className="sticky bottom-0 mt-4 border-t bg-popover p-4">
                <a
                  href={`${bookingBaseUrl}?professionalId=${professional.id}`}
                  className="flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar com {professional.name.split(' ')[0]}
                </a>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
