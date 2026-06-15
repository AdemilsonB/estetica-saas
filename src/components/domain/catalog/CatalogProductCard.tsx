import type { Prisma } from '@prisma/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ActivationBadge } from './ActivationBadge'
import { formatPrice } from './catalog-utils'

interface CatalogProductCardProps {
  product: {
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    suggestedPrice: Prisma.Decimal | number
    category: { name: string } | null
  }
  isActivated: boolean
  activatedHref?: string
  onActivate: (productId: string) => void
  isActivating?: boolean
}

export function CatalogProductCard({
  product,
  isActivated,
  activatedHref,
  onActivate,
  isActivating = false,
}: CatalogProductCardProps) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {product.category && (
          <Badge variant="outline" className="w-fit text-xs">
            {product.category.name}
          </Badge>
        )}

        <div className="flex-1 space-y-1">
          <p className="font-semibold leading-snug">{product.name}</p>
          {product.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{formatPrice(product.suggestedPrice)}</p>

          {isActivated ? (
            <ActivationBadge href={activatedHref} />
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isActivating}
              onClick={() => onActivate(product.id)}
            >
              {isActivating ? 'Ativando...' : 'Ativar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
