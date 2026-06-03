'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { usePromotions, useDeactivatePromotion, type Promotion } from '@/hooks/scheduling/use-promotions'
import { PromotionFormModal } from './promotion-form-modal'

function PromotionStatusBadge({ promo }: { promo: Promotion }) {
  if (!promo.active) return <Badge variant="secondary" className="text-xs">Inativa</Badge>
  if (promo.expired) return <Badge variant="secondary" className="text-xs text-muted-foreground">Expirada</Badge>
  if (promo.startsAt && new Date(promo.startsAt) > new Date()) {
    return <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">Agendada</Badge>
  }
  return <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Ativa</Badge>
}

function formatDiscount(promo: Promotion): string {
  if (promo.discountType === 'PERCENTAGE') {
    return `${Number(promo.discountValue).toLocaleString('pt-BR')}% de desconto`
  }
  return `${Number(promo.discountValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`
}

export function PromotionCatalog() {
  const { data: promotions, isLoading, isError, refetch } = usePromotions()
  const { mutate: deactivate } = useDeactivatePromotion()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | undefined>()

  function handleEdit(promo: Promotion) {
    setEditingPromotion(promo)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingPromotion(undefined)
    setModalOpen(true)
  }

  function handleDeactivate(promo: Promotion) {
    if (!confirm(`Desativar promoção "${promo.name}"?`)) return
    deactivate(promo.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-destructive/30 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar promoções.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{promotions?.length ?? 0} promoção(ões) cadastrada(s)</p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Nova promoção
        </Button>
      </div>

      {promotions?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma promoção cadastrada ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">Criar primeira promoção</Button>
        </div>
      )}

      {promotions && promotions.length > 0 && (
        <div className="space-y-2">
          {promotions.map((promo) => (
            <div key={promo.id} className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
              {promo.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={promo.imageUrl} alt={promo.name} className="size-12 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{promo.name}</span>
                  <PromotionStatusBadge promo={promo} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDiscount(promo)}</p>
                {promo.endsAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    Válida até {new Date(promo.endsAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)} className="size-8" title="Editar">
                  <Edit2 className="size-3.5" />
                </Button>
                {promo.active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeactivate(promo)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Desativar"
                  >
                    <Power className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PromotionFormModal open={modalOpen} onClose={() => setModalOpen(false)} promotion={editingPromotion} />
    </div>
  )
}
