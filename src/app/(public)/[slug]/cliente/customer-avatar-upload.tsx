'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { ImageCropEditor, type CropValues } from '@/components/domain/shared/image-crop-editor'

type Props = {
  slug: string
  name: string
  initialAvatarUrl: string | null
  initialCrop: CropValues | null
}

/**
 * Upload + enquadramento da foto de perfil do cliente logado (sessão pública).
 * Mesma UX do avatar do profissional (círculo + editar enquadramento), porém
 * autossuficiente via fetch nos endpoints públicos /me/avatar.
 */
export function CustomerAvatarUpload({ slug, name, initialAvatarUrl, initialCrop }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [crop, setCrop] = useState<CropValues | null>(initialCrop)
  const [editorOpen, setEditorOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingCrop, setSavingCrop] = useState(false)

  const initials = name.slice(0, 2).toUpperCase()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/public/${slug}/me/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(data?.error?.message ?? 'Falha no upload')
      }
      const { avatarUrl: url } = (await res.json()) as { avatarUrl: string }
      setAvatarUrl(url)
      setCrop(null)
      toast.success('Foto atualizada')
      setEditorOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar foto')
    } finally {
      setUploading(false)
    }
  }

  async function handleCropSave(values: CropValues) {
    setSavingCrop(true)
    try {
      const res = await fetch(`/api/public/${slug}/me/avatar`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error()
      setCrop(values)
      setEditorOpen(false)
      toast.success('Enquadramento salvo')
    } catch {
      toast.error('Erro ao salvar enquadramento')
    } finally {
      setSavingCrop(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <EntityImage
          src={avatarUrl}
          alt={name}
          shape="circle"
          cropX={crop?.cropX}
          cropY={crop?.cropY}
          cropZoom={crop?.cropZoom}
          className="size-16 border"
          fallback={<span className="text-lg font-semibold">{initials}</span>}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Alterar foto de perfil"
          className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border bg-background shadow-sm"
        >
          <Camera className="size-3.5" />
        </button>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
            <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {uploading ? 'Enviando...' : avatarUrl ? 'Alterar foto' : 'Adicionar foto'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Ajustar enquadramento
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">jpg, png ou webp · máx 2 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {avatarUrl && (
        <ImageCropEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={avatarUrl}
          shape="circle"
          initial={crop}
          onSave={handleCropSave}
          saving={savingCrop}
        />
      )}
    </div>
  )
}
