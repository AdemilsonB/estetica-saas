'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCreateCatalogService, useUpdateCatalogService, type CatalogServiceItem, type CatalogCategory } from '@/hooks/admin/use-admin-catalog'

const SEGMENTS = [
  { value: 'HAIR_SALON',  label: 'Salão' },
  { value: 'BARBERSHOP',  label: 'Barbearia' },
  { value: 'NAIL_DESIGN', label: 'Nail Design' },
  { value: 'AESTHETICS',  label: 'Estética' },
] as const

const toSlug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

interface Props {
  open: boolean
  onClose: () => void
  service?: CatalogServiceItem | null
  categories: CatalogCategory[]
}

export function CatalogServiceSheet({ open, onClose, service, categories }: Props) {
  const isEditing = !!service
  const createMutation = useCreateCatalogService()
  const updateMutation = useUpdateCatalogService()
  const isPending = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState({
    name: '', slug: '', description: '', segments: [] as string[],
    categoryId: '', suggestedDuration: 60, suggestedPrice: 0,
    priceType: 'FIXED' as 'FIXED' | 'STARTING_FROM', order: 0, active: true,
  })
  const [slugManual, setSlugManual] = useState(false)

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name, slug: service.slug, description: service.description ?? '',
        segments: service.segments, categoryId: service.categoryId ?? '',
        suggestedDuration: service.suggestedDuration,
        suggestedPrice: Number(service.suggestedPrice),
        priceType: service.priceType, order: service.order, active: service.active,
      })
      setSlugManual(true)
    } else {
      setForm({ name: '', slug: '', description: '', segments: [], categoryId: '',
        suggestedDuration: 60, suggestedPrice: 0, priceType: 'FIXED', order: 0, active: true })
      setSlugManual(false)
    }
  }, [service, open])

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, ...(!slugManual ? { slug: toSlug(name) } : {}) }))
  }

  function toggleSegment(seg: string) {
    setForm(f => ({
      ...f,
      segments: f.segments.includes(seg) ? f.segments.filter(s => s !== seg) : [...f.segments, seg],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.slug || form.segments.length === 0) {
      toast.error('Preencha nome, slug e ao menos um segmento.')
      return
    }
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || undefined,
        description: form.description || undefined,
      }
      if (isEditing) {
        await updateMutation.mutateAsync({ id: service!.id, ...payload })
        toast.success('Serviço atualizado!')
      } else {
        await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0])
        toast.success('Serviço criado!')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar serviço')
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={form.name} onChange={e => handleNameChange(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" value={form.slug}
              onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
              pattern="^[a-z0-9-]+$" required />
            <p className="text-xs text-slate-400">Apenas letras minúsculas, números e hífens</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Descrição</Label>
            <Input id="desc" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Segmentos *</Label>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENTS.map(s => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.segments.includes(s.value)}
                    onCheckedChange={() => toggleSegment(s.value)} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.categoryId || 'none'} onValueChange={v => setForm(f => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dur">Duração (min) *</Label>
              <Input id="dur" type="number" min={1} value={form.suggestedDuration}
                onChange={e => setForm(f => ({ ...f, suggestedDuration: Number(e.target.value) }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="price">Preço sugerido (R$) *</Label>
              <Input id="price" type="number" min={0} step={0.01} value={form.suggestedPrice}
                onChange={e => setForm(f => ({ ...f, suggestedPrice: Number(e.target.value) }))} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Tipo de preço</Label>
            <div className="flex gap-4">
              {(['FIXED', 'STARTING_FROM'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="priceType" value={t} checked={form.priceType === t}
                    onChange={() => setForm(f => ({ ...f, priceType: t }))} />
                  <span className="text-sm">{t === 'FIXED' ? 'Fixo' : 'A partir de'}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="order">Ordem</Label>
              <Input id="order" type="number" value={form.order}
                onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch id="active" checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label htmlFor="active">Ativo</Label>
            </div>
          </div>
          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
