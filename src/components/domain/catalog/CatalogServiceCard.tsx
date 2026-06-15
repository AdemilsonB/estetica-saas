import type { Prisma } from '@prisma/client'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice, formatDuration } from './catalog-utils'

interface CatalogServiceCardProps {
  service: {
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    suggestedDuration: number
    suggestedPrice: Prisma.Decimal | number
    priceType: 'FIXED' | 'STARTING_FROM'
    category: { name: string } | null
  }
  isActivated: boolean
  onActivate: (serviceId: string) => void
  isActivating?: boolean
  onDeactivate: (serviceId: string) => void
  isDeactivating?: boolean
}

export function CatalogServiceCard({
  service,
  isActivated,
  onActivate,
  isActivating = false,
  onDeactivate,
  isDeactivating = false,
}: CatalogServiceCardProps) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {service.category && (
          <Badge variant="outline" className="w-fit text-xs">
            {service.category.name}
          </Badge>
        )}

        <div className="flex-1 space-y-1">
          <p className="font-semibold leading-snug">{service.name}</p>
          {service.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {service.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4 shrink-0" />
          <span>{formatDuration(service.suggestedDuration)}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {service.priceType === 'STARTING_FROM'
              ? `A partir de ${formatPrice(service.suggestedPrice)}`
              : formatPrice(service.suggestedPrice)}
          </p>

          {isActivated ? (
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-red-50 hover:border-red-400 hover:text-red-600"
              disabled={isDeactivating}
              onClick={() => onDeactivate(service.id)}
            >
              {isDeactivating ? 'Removendo...' : '✓ Ativado'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isActivating}
              onClick={() => onActivate(service.id)}
            >
              {isActivating ? 'Ativando...' : 'Ativar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
