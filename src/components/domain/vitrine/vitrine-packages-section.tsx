import Link from 'next/link'
import { Clock } from 'lucide-react'

type PublicPackage = {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  price: number
  duration: number
  services: { id: string; name: string }[]
}

type Props = {
  packages: PublicPackage[]
  bookingBaseUrl: string
  primaryColor: string
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

export function VitrinePackagesSection({ packages, bookingBaseUrl, primaryColor }: Props) {
  if (packages.length === 0) return null

  return (
    <section id="pacotes" className="mx-auto max-w-3xl px-4 pt-8">
      <h2 className="mb-5 text-lg font-bold">Pacotes</h2>
      <div className="space-y-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex gap-3 p-3">
              {/* Thumbnail */}
              <div className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
                {pkg.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pkg.imageUrl} alt={pkg.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </div>

              {/* Conteúdo */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm font-semibold leading-snug">{pkg.name}</p>
                <p className="text-xs">
                  <span className="font-medium" style={{ color: primaryColor }}>
                    R$ {pkg.price.toFixed(2)}
                  </span>
                  {pkg.duration > 0 && (
                    <span className="text-muted-foreground">
                      {' · '}
                      <Clock className="inline size-3" /> {formatDuration(pkg.duration)}
                    </span>
                  )}
                </p>

                {pkg.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {pkg.description}
                  </p>
                )}

                {/* Chips de serviços incluídos */}
                {pkg.services.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {pkg.services.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}

                <Link
                  href={`${bookingBaseUrl}?packageId=${pkg.id}`}
                  className="mt-1.5 inline-flex h-8 w-full items-center justify-center rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar pacote
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
