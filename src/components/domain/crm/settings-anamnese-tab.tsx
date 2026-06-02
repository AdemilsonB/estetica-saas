'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AnamneseFieldEditorDialog } from './anamnese-field-editor-dialog'
import {
  useAnamneseTemplate,
  useUpdateAnamneseTemplate,
} from '@/hooks/crm/use-anamnese-template'
import {
  DEFAULT_ANAMNESE_FIELDS,
  DEFAULT_LINK_MESSAGE,
  type FieldDef,
} from '@/domains/crm/types'

const SECTION_LABELS: Record<string, string> = {
  basico:    'Informações básicas',
  saude:     'Histórico de saúde',
  estetico:  'Histórico estético',
  objetivos: 'Objetivos e expectativas',
}

const SECTIONS = ['basico', 'saude', 'estetico', 'objetivos']

function SortableFieldRow({
  field,
  onEdit,
  onRemove,
}: {
  field: FieldDef
  onEdit: (f: FieldDef) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-300 hover:text-slate-500"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1 text-sm text-slate-800">{field.label}</span>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        {field.type}
      </Badge>
      <Badge
        variant={field.required ? 'default' : 'secondary'}
        className="text-[10px] px-1.5 py-0"
      >
        {field.required ? 'obrigatório' : 'opcional'}
      </Badge>
      <button
        onClick={() => onEdit(field)}
        className="text-slate-400 hover:text-slate-700"
        aria-label="Editar campo"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        onClick={() => onRemove(field.id)}
        className="text-slate-400 hover:text-destructive"
        aria-label="Remover campo"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

export function SettingsAnamneseTab() {
  const { data: template, isLoading } = useAnamneseTemplate()
  const { mutateAsync: updateTemplate, isPending: saving } = useUpdateAnamneseTemplate()

  const [fields, setFields] = useState<FieldDef[]>([])
  const [linkMessage, setLinkMessage] = useState('')
  const [synced, setSynced] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingField, setEditingField] = useState<FieldDef | undefined>()

  if (template && !synced) {
    setFields(template.fields)
    setLinkMessage(template.linkMessage ?? DEFAULT_LINK_MESSAGE)
    setSynced(true)
  }

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id)
      const newIndex = prev.findIndex((f) => f.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function handleSaveField(field: FieldDef) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === field.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = field
        return next
      }
      return [...prev, field]
    })
  }

  function handleRemoveField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  async function handleSave() {
    try {
      await updateTemplate({ fields, linkMessage })
      toast.success('Configurações de anamnese salvas')
    } catch {
      toast.error('Falha ao salvar configurações')
    }
  }

  function handleRestore() {
    setFields(DEFAULT_ANAMNESE_FIELDS)
    setLinkMessage(DEFAULT_LINK_MESSAGE)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Campos do formulário</h3>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => {
            setEditingField(undefined)
            setEditorOpen(true)
          }}
        >
          <Plus className="size-3" />
          Adicionar campo
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {SECTIONS.map((sectionKey) => {
              const sectionFields = fields.filter((f) => f.section === sectionKey)
              if (sectionFields.length === 0) return null
              return (
                <div
                  key={sectionKey}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {SECTION_LABELS[sectionKey]}
                  </p>
                  <div className="space-y-1.5">
                    {sectionFields.map((field) => (
                      <SortableFieldRow
                        key={field.id}
                        field={field}
                        onEdit={(f) => {
                          setEditingField(f)
                          setEditorOpen(true)
                        }}
                        onRemove={handleRemoveField}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div>
        <Label className="text-sm font-medium">Mensagem padrão do link WhatsApp</Label>
        <Textarea
          value={linkMessage}
          onChange={(e) => setLinkMessage(e.target.value)}
          className="mt-2 min-h-[100px] resize-none text-sm"
        />
        <p className="mt-1 text-xs text-slate-400">
          Variáveis: <code>{'{nome}'}</code>, <code>{'{link}'}</code>
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-slate-500">
              <RotateCcw className="size-3" />
              Restaurar campos padrão
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar campos padrão?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação substituirá todos os campos personalizados pelos campos padrão do
                sistema. Não é possível desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestore}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Restaurar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          onClick={handleSave}
          disabled={saving || fields.length === 0}
          className="bg-slate-950 text-white hover:bg-slate-800"
          size="sm"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>

      <AnamneseFieldEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editingField}
        onSave={handleSaveField}
      />
    </div>
  )
}
