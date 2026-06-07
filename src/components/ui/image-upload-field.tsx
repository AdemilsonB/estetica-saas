'use client'

import { useRef, useState } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'

type Props = {
  entityType: 'services' | 'packages' | 'promotions'
  entityId: string | null
  value: string | null
  onChange: (url: string | null) => void
  label?: string
}

export function ImageUploadField({ entityType, entityId, value, onChange, label = 'Imagem' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo excede o limite de 5 MB.')
      return
    }
    if (!entityId) {
      toast.error('Salve o serviço primeiro para adicionar uma imagem.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('entityType', entityType)
      form.append('entityId', entityId)
      const res = await fetch('/api/uploads/service-images', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Erro no upload')
      }
      const { url } = await res.json()
      onChange(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            aria-label="Remover imagem"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-8 text-sm text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <ImageIcon className="size-6" />
          {uploading ? 'Enviando...' : 'Clique para adicionar foto'}
          <span className="text-xs">JPEG, PNG ou WebP · máx. 5 MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
