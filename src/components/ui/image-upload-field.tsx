'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { ImageCropEditor, type CropValues } from '@/components/domain/shared/image-crop-editor'

type Props = {
  entityType: 'services' | 'packages' | 'promotions' | 'products'
  entityId: string | null
  value: string | null
  onChange: (url: string | null) => void
  cropShape: 'portrait' | 'square'
  crop: CropValues | null
  onCropChange: (crop: CropValues | null) => void
  label?: string
  savePromptMessage?: string
}

export function ImageUploadField({
  entityType,
  entityId,
  value,
  onChange,
  cropShape,
  crop,
  onCropChange,
  label = 'Imagem',
  savePromptMessage,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo excede o limite de 5 MB.')
      return
    }
    if (!entityId) {
      toast.error(savePromptMessage ?? 'Salve o registro primeiro para adicionar uma imagem.')
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
      onCropChange(null)
      setEditorOpen(true)
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
        <div className="relative w-full max-w-56">
          <EntityImage
            src={value}
            alt="preview"
            shape={cropShape}
            cropX={crop?.cropX}
            cropY={crop?.cropY}
            cropZoom={crop?.cropZoom}
            className="w-full border border-border"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            aria-label="Remover imagem"
          >
            <X className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5 text-xs text-white hover:bg-black/80"
          >
            <Pencil className="size-3" />
            Ajustar
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

      {value && (
        <ImageCropEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={value}
          shape={cropShape}
          initial={crop}
          onSave={(v) => {
            onCropChange(v)
            setEditorOpen(false)
          }}
        />
      )}
    </div>
  )
}
