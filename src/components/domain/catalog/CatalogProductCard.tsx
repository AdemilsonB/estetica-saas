import type { Prisma } from '@prisma/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  onActivate: (productId: string) => void
  isActivating?: boolean
  onDeactivate: (productId: string) => void
  isDeactivating?: boolean
}

export function CatalogProductCard({
  product,
  isActivated,
  onActivate,
  isActivating = false,
  onDeactivate,
  isDeactivating = false,
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
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-red-50 hover:border-red-400 hover:text-red-600"
              disabled={isDeactivating}
              onClick={() => onDeactivate(product.id)}
            >
              {isDeactivating ? 'Removendo...' : '✓ Ativado'}
            </Button>
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
