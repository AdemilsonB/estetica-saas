'use client'

import { useServiceCategories } from '@/hooks/scheduling/use-service-categories'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  value: string // 'all' ou categoryId
  onChange: (value: string) => void
}

export function CategorySelect({ value, onChange }: Props) {
  const { data: categorias } = useServiceCategories()
  if (!categorias || categorias.length === 0) return null

  // Filtra apenas categorias ativas
  const ativas = categorias.filter((c) => c.active)
  if (ativas.length === 0) return null

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue placeholder="Categoria: Todas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as categorias</SelectItem>
        {ativas.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
