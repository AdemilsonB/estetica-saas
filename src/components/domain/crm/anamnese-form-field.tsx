'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { FieldDef } from '@/domains/crm/types'

type Props = {
  field: FieldDef
  value: string | string[] | boolean | null
  onChange: (value: string | string[] | boolean | null) => void
}

export function AnamneseFormField({ field, value, onChange }: Props) {
  const [comboOpen, setComboOpen] = useState(false)
  const useCombobox =
    (field.type === 'select' || field.type === 'checkbox') && field.options.length > 5

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={field.id}
          checked={value === true}
          onCheckedChange={(checked: string | boolean) => onChange(checked === true)}
        />
        <Label htmlFor={field.id} className="text-sm cursor-pointer">
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[80px] resize-none text-sm"
          placeholder={`Digite ${field.label.toLowerCase()}...`}
        />
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
          placeholder={`Digite ${field.label.toLowerCase()}...`}
        />
      </div>
    )
  }

  if (field.type === 'checkbox') {
    const selected = Array.isArray(value) ? value : []

    if (useCombobox) {
      return (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">
            {field.label}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-8 text-sm">
                {selected.length > 0 ? selected.join(', ') : 'Selecionar...'}
                <ChevronsUpDown className="size-3 ml-1 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar..." className="h-8" />
                <CommandList>
                  <CommandEmpty>Nenhum resultado.</CommandEmpty>
                  <CommandGroup>
                    {field.options.map((opt) => (
                      <CommandItem
                        key={opt}
                        onSelect={() => {
                          const next = selected.includes(opt)
                            ? selected.filter((v) => v !== opt)
                            : [...selected, opt]
                          onChange(next)
                        }}
                      >
                        <Check
                          className={`mr-2 size-3 ${selected.includes(opt) ? 'opacity-100' : 'opacity-0'}`}
                        />
                        {opt}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )
    }

    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <div className="grid grid-cols-2 gap-1">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center gap-1.5">
              <Checkbox
                id={`${field.id}-${opt}`}
                checked={selected.includes(opt)}
                onCheckedChange={(checked: string | boolean) => {
                  const next = checked
                    ? [...selected, opt]
                    : selected.filter((v) => v !== opt)
                  onChange(next)
                }}
              />
              <Label htmlFor={`${field.id}-${opt}`} className="text-xs cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // select single
  const selectedValue = typeof value === 'string' ? value : ''

  if (useCombobox) {
    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-8 text-sm">
              {selectedValue || 'Selecionar...'}
              <ChevronsUpDown className="size-3 ml-1 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar..." className="h-8" />
              <CommandList>
                <CommandEmpty>Nenhum resultado.</CommandEmpty>
                <CommandGroup>
                  {field.options.map((opt) => (
                    <CommandItem
                      key={opt}
                      onSelect={() => {
                        onChange(opt === selectedValue ? '' : opt)
                        setComboOpen(false)
                      }}
                    >
                      <Check
                        className={`mr-2 size-3 ${selectedValue === opt ? 'opacity-100' : 'opacity-0'}`}
                      />
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {field.options.map((opt) => (
          <div key={opt} className="flex items-center gap-1.5">
            <Checkbox
              id={`${field.id}-${opt}`}
              checked={selectedValue === opt}
              onCheckedChange={() => onChange(selectedValue === opt ? '' : opt)}
            />
            <Label htmlFor={`${field.id}-${opt}`} className="text-xs cursor-pointer">
              {opt}
            </Label>
          </div>
        ))}
      </div>
    </div>
  )
}
