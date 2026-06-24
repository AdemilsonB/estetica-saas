'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ComboboxField } from '@/components/ui/combobox-field'
import { useCreateProduct, useUpdateProduct } from '@/hooks/inventory/use-products'
import { useProductCategories } from '@/hooks/inventory/use-product-categories'
import { ImageUploadField } from '@/components/ui/image-upload-field'
import type { CropValues } from '@/components/domain/shared/image-crop-editor'
import type { CreateProductInput } from '@/domains/inventory/types'

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  categoryId: z.string().optional(),
  costPrice: z
    .string()
    .min(1, 'Preço de custo é obrigatório')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Valor inválido'),
  salePrice: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'Valor inválido'),
  stockQuantity: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || v === '' || (!isNaN(parseInt(v ?? '')) && parseInt(v ?? '') >= 0),
      'Valor inválido',
    ),
  lowStockAlert: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || v === '' || (!isNaN(parseInt(v ?? '')) && parseInt(v ?? '') >= 0),
      'Valor inválido',
    ),
})

type FormValues = z.infer<typeof schema>

function buildProductPayload(values: FormValues): CreateProductInput {
  const costPrice = parseFloat(values.costPrice)
  const salePriceRaw = values.salePrice !== undefined && values.salePrice !== ''
    ? parseFloat(values.salePrice)
    : undefined
  const salePrice = salePriceRaw !== undefined && !isNaN(salePriceRaw) ? salePriceRaw : undefined
  const stockQuantity =
    values.stockQuantity !== undefined && values.stockQuantity !== ''
      ? parseInt(values.stockQuantity, 10)
      : 0
  const lowStockAlert =
    values.lowStockAlert !== undefined && values.lowStockAlert !== ''
      ? parseInt(values.lowStockAlert, 10)
      : 5

  return {
    name: values.name,
    categoryId: values.categoryId || undefined,
    costPrice,
    salePrice,
    stockQuantity,
    lowStockAlert,
  }
}

type Product = {
  id: string
  name: string
  categoryId: string | null
  costPrice: string
  salePrice: string
  stockQuantity?: number
  lowStockAlert: number
  imageUrl: string | null
  imageCropX: number | null
  imageCropY: number | null
  imageCropZoom: number | null
}

type Props = {
  open: boolean
  onClose: () => void
  product?: Product | null
}

export function ProductFormModal({ open, onClose, product }: Props) {
  const isEditing = !!product

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropValues | null>(null)
  const [adjustTarget, setAdjustTarget] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const queryClient = useQueryClient()

  const { data: categories = [] } = useProductCategories()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const isPending = createProduct.isPending || updateProduct.isPending

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      categoryId: undefined,
      costPrice: '',
      salePrice: '',
      lowStockAlert: '',
    },
  })

  useEffect(() => {
    if (open && product) {
      reset({
        name: product.name,
        categoryId: product.categoryId ?? undefined,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        lowStockAlert: String(product.lowStockAlert),
      })
      setImageUrl(product.imageUrl ?? null)
      setCrop(
        product.imageCropX != null && product.imageCropY != null && product.imageCropZoom != null
          ? { cropX: product.imageCropX, cropY: product.imageCropY, cropZoom: product.imageCropZoom }
          : null,
      )
      setAdjustTarget('')
    } else if (open && !product) {
      reset({
        name: '',
        categoryId: undefined,
        costPrice: '',
        salePrice: '',
        lowStockAlert: '',
      })
      setImageUrl(null)
      setCrop(null)
      setAdjustTarget('')
    }
  }, [open, product, reset])

  function handleClose() {
    reset()
    setImageUrl(null)
    setCrop(null)
    setAdjustTarget('')
    onClose()
  }

  async function handleAdjustStock() {
    if (!product?.id || adjustTarget === '') return
    const qty = parseInt(adjustTarget, 10)
    if (isNaN(qty) || qty < 0) {
      toast.error('Quantidade inválida')
      return
    }
    setAdjusting(true)
    try {
      const res = await fetch(`/api/products/${product.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetQuantity: qty }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body?.error?.message ?? 'Erro ao ajustar estoque')
      }
      toast.success(`Estoque ajustado para ${qty} unidades`)
      setAdjustTarget('')
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ajustar estoque')
    } finally {
      setAdjusting(false)
    }
  }

  function onSubmit(values: FormValues) {
    if (isEditing && product) {
      const updatePayload = {
        ...buildProductPayload(values),
        imageUrl: imageUrl ?? undefined,
        imageCropX: crop?.cropX ?? null,
        imageCropY: crop?.cropY ?? null,
        imageCropZoom: crop?.cropZoom ?? null,
      }
      updateProduct.mutate(
        { id: product.id, ...updatePayload },
        {
          onSuccess: () => {
            toast.success('Produto atualizado com sucesso')
            handleClose()
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Erro ao atualizar produto')
          },
        },
      )
    } else {
      createProduct.mutate({ ...buildProductPayload(values), imageUrl: imageUrl ?? undefined }, {
        onSuccess: () => {
          toast.success('Produto criado com sucesso')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao criar produto')
        },
      })
    }
  }

  const categoryId = watch('categoryId')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">
              Nome <span className="text-rose-500">*</span>
            </Label>
            <Input id="prod-name" placeholder="Nome do produto" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <ComboboxField
              options={[
                { value: '__none__', label: 'Sem categoria' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={categoryId ?? '__none__'}
              onChange={(v) => setValue('categoryId', v === '__none__' || !v ? undefined : v)}
              placeholder="Selecionar categoria..."
              searchPlaceholder="Buscar categoria..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost">
                Preço de Custo (R$) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="prod-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register('costPrice')}
              />
              {errors.costPrice && (
                <p className="text-xs text-rose-500">{errors.costPrice.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-sale">
                Preço de Venda (R$)
              </Label>
              <Input
                id="prod-sale"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register('salePrice')}
              />
              {errors.salePrice && (
                <p className="text-xs text-rose-500">{errors.salePrice.message}</p>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="prod-stock">Quantidade Inicial em Estoque</Label>
              <Input
                id="prod-stock"
                type="number"
                min="0"
                placeholder="0"
                {...register('stockQuantity')}
              />
              {errors.stockQuantity && (
                <p className="text-xs text-rose-500">{errors.stockQuantity.message}</p>
              )}
            </div>
          )}

          {isEditing && product?.stockQuantity !== undefined && (
            <div className="space-y-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
                <div className="text-muted-foreground">
                  Estoque atual:{' '}
                  <strong className="text-foreground">{product.stockQuantity} unidade(s)</strong>
                </div>
                <div className="text-muted-foreground">
                  Valor em estoque:{' '}
                  <strong className="text-foreground">
                    {(Number(product.salePrice) * product.stockQuantity).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </strong>
                  <span className="ml-1 text-xs">(preço de venda × qtd)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-adjust">Ajustar estoque para (unidades)</Label>
                <div className="flex gap-2">
                  <Input
                    id="prod-adjust"
                    type="number"
                    min={0}
                    step={1}
                    value={adjustTarget}
                    onChange={(e) => setAdjustTarget(e.target.value)}
                    placeholder={String(product.stockQuantity)}
                    disabled={adjusting}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={adjusting || adjustTarget === ''}
                    onClick={handleAdjustStock}
                  >
                    {adjusting ? 'Ajustando...' : 'Ajustar'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="prod-alert">Alerta de Estoque Mínimo</Label>
            <Input
              id="prod-alert"
              type="number"
              min="0"
              placeholder="Ex: 5"
              {...register('lowStockAlert')}
            />
            {errors.lowStockAlert && (
              <p className="text-xs text-rose-500">{errors.lowStockAlert.message}</p>
            )}
            <p className="text-xs text-slate-400">
              Receber alerta quando o estoque atingir este nível
            </p>
          </div>

          {isEditing && product ? (
            <div className="space-y-1.5">
              <Label>Imagem do produto</Label>
              <ImageUploadField
                value={imageUrl}
                onChange={setImageUrl}
                entityId={product.id}
                entityType="products"
                cropShape="square"
                crop={crop}
                onCropChange={setCrop}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Salve o produto primeiro para adicionar uma imagem.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? 'Salvando...'
                  : 'Criando...'
                : isEditing
                  ? 'Salvar alterações'
                  : 'Criar produto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
