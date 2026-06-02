'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { FieldDef, FieldType, FieldSection } from '@/domains/crm/types'

type Props = {
  open: boolean
  onClose: () => void
  initial?: FieldDef
  onSave: (field: FieldDef) => void
}

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',     label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'boolean',  label: 'Sim / Não' },
  { value: 'select',   label: 'Seleção única' },
  { value: 'checkbox', label: 'Múltipla escolha' },
]

const SECTIONS: { value: FieldSection; label: string }[] = [
  { value: 'basico',    label: 'Informações básicas' },
  { value: 'saude',     label: 'Histórico de saúde' },
  { value: 'estetico',  label: 'Histórico estético' },
  { value: 'objetivos', label: 'Objetivos e expectativas' },
]

function makeId(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 50)
}

export function AnamneseFieldEditorDialog({ open, onClose, initial, onSave }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [type, setType] = useState<FieldType>(initial?.type ?? 'text')
  const [section, setSection] = useState<FieldSection>(initial?.section ?? 'basico')
  const [required, setRequired] = useState(initial?.required ?? false)
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join(', '))

  function handleSave() {
    const options = ['select', 'checkbox'].includes(type)
      ? optionsText.split(',').map((o) => o.trim()).filter(Boolean)
      : []

    onSave({
      id: initial?.id ?? makeId(label),
      label: label.trim(),
      type,
      options,
      required,
      section,
    })
    onClose()
  }

  const isValid = label.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar campo' : 'Novo campo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Label *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex: Tipo de pele"
              className="mt-1 h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Seção</Label>
              <Select value={section} onValueChange={(v) => setSection(v as FieldSection)}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {['select', 'checkbox'].includes(type) && (
            <div>
              <Label className="text-xs font-medium">
                Opções (separadas por vírgula)
              </Label>
              <Textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="ex: Normal, Seca, Oleosa, Mista"
                className="mt-1 min-h-[60px] resize-none text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="required"
              checked={required}
              onCheckedChange={(v) => setRequired(v === true)}
            />
            <Label htmlFor="required" className="text-xs cursor-pointer">
              Campo obrigatório
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} size="sm">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isValid} size="sm">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
