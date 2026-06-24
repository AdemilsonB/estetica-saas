'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, PowerOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAdminCatalogCategories,
  useCreateCatalogServiceCategory,
  useUpdateCatalogServiceCategory,
  useDeactivateCatalogServiceCategory,
  useCreateCatalogProductCategory,
  useUpdateCatalogProductCategory,
  useDeactivateCatalogProductCategory,
  type CatalogCategory,
} from '@/hooks/admin/use-admin-catalog'

const SEGMENTS = [
  { value: 'HAIR_SALON',  label: 'Salão' },
  { value: 'BARBERSHOP',  label: 'Barbearia' },
  { value: 'NAIL_DESIGN', label: 'Nail Design' },
  { value: 'AESTHETICS',  label: 'Estética' },
] as const

const SEGMENT_LABEL: Record<string, string> = {
  HAIR_SALON: 'Salão', BARBERSHOP: 'Barbearia',
  NAIL_DESIGN: 'Nail Design', AESTHETICS: 'Estética',
}

const toSlug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

function CategoryFormDialog({
  open, onClose, item, onSave, isPending,
}: {
  open: boolean
  onClose: () => void
  item?: CatalogCategory | null
  onSave: (data: { slug: string; name: string; segments: string[]; order: number }) => void
  isPending: boolean
}) {
  const isEditing = !!item
  const [form, setForm] = useState({ name: '', slug: '', segments: [] as string[], order: 0 })
  const [slugManual, setSlugManual] = useState(false)

  useEffect(() => {
    if (item) {
      setForm({ name: item.name, slug: item.slug, segments: item.segments, order: item.order })
      setSlugManual(true)
    } else {
      setForm({ name: '', slug: '', segments: [], order: 0 })
      setSlugManual(false)
    }
  }, [item, open])

  function toggleSegment(seg: string) {
    setForm(f => ({
      ...f,
      segments: f.segments.includes(seg) ? f.segments.filter(s => s !== seg) : [...f.segments, seg],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.slug || form.segments.length === 0) {
      toast.error('Preencha nome, slug e ao menos um segmento.')
      return
    }
    onSave(form)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cat-name">Nome *</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={e => {
                const name = e.target.value
                setForm(f => ({ ...f, name, ...(!slugManual ? { slug: toSlug(name) } : {}) }))
              }}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-slug">Slug *</Label>
            <Input
              id="cat-slug"
              value={form.slug}
              onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
              pattern="^[a-z0-9-]+$"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Segmentos *</Label>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENTS.map(s => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.segments.includes(s.value)} onCheckedChange={() => toggleSegment(s.value)} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-order">Ordem</Label>
            <Input
              id="cat-order"
              type="number"
              value={form.order}
              onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryManagerPanel({ kind }: { kind: 'services' | 'products' }) {
  const { data, isLoading } = useAdminCatalogCategories(true)
  const categories = (kind === 'services' ? data?.services : data?.products) ?? []

  const createService = useCreateCatalogServiceCategory()
  const updateService = useUpdateCatalogServiceCategory()
  const deactivateService = useDeactivateCatalogServiceCategory()
  const createProduct = useCreateCatalogProductCategory()
  const updateProduct = useUpdateCatalogProductCategory()
  const deactivateProduct = useDeactivateCatalogProductCategory()

  const createMutation = kind === 'services' ? createService : createProduct
  const updateMutation = kind === 'services' ? updateService : updateProduct
  const deactivateMutation = kind === 'services' ? deactivateService : deactivateProduct

  const [dialog, setDialog] = useState<{ open: boolean; item?: CatalogCategory | null }>({ open: false })

  function handleSave(formData: { slug: string; name: string; segments: string[]; order: number }) {
    if (dialog.item) {
      updateMutation.mutate({ id: dialog.item.id, ...formData }, {
        onSuccess: () => { toast.success('Categoria atualizada!'); setDialog({ open: false }) },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar categoria'),
      })
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => { toast.success('Categoria criada!'); setDialog({ open: false }) },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar categoria'),
      })
    }
  }

  function handleToggleActive(category: CatalogCategory) {
    if (category.active) {
      deactivateMutation.mutate(category.id, {
        onSuccess: () => toast.success('Categoria desativada!'),
        onError: () => toast.error('Erro ao desativar categoria'),
      })
    } else {
      updateMutation.mutate({ id: category.id, active: true }, {
        onSuccess: () => toast.success('Categoria reativada!'),
        onError: () => toast.error('Erro ao reativar categoria'),
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialog({ open: true, item: null })}>
          <Plus className="size-4 mr-1.5" /> Nova categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : categories.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Nenhuma categoria cadastrada
        </p>
      ) : (
        <div className="space-y-2">
          {categories.map(c => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <button
                  type="button"
                  className="font-medium text-slate-900 hover:underline"
                  onClick={() => setDialog({ open: true, item: c })}
                >
                  {c.name}
                </button>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.segments.map(s => (
                    <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {SEGMENT_LABEL[s] ?? s}
                    </span>
                  ))}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className={`size-8 ${c.active ? 'text-red-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'}`}
                onClick={() => handleToggleActive(c)}
              >
                {c.active ? <PowerOff className="size-3.5" /> : <RotateCcw className="size-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        open={dialog.open}
        item={dialog.item}
        onClose={() => setDialog({ open: false })}
        onSave={handleSave}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
