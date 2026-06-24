'use client'

import { useState } from 'react'
import { useRef } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useUpdateAvatarCrop, useUploadAvatar } from '@/hooks/iam/use-team'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { ImageCropEditor, type CropValues } from '@/components/domain/shared/image-crop-editor'

type Props = {
  userId: string
  currentAvatarUrl: string | null
  cropX?: number | null
  cropY?: number | null
  cropZoom?: number | null
  name: string
  onUploaded: (url: string) => void
}

export function AvatarUpload({ userId, currentAvatarUrl, cropX, cropY, cropZoom, name, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl)
  const [crop, setCrop] = useState<CropValues | null>(
    cropX != null && cropY != null && cropZoom != null ? { cropX, cropY, cropZoom } : null,
  )
  const [editorOpen, setEditorOpen] = useState(false)
  const uploadAvatar = useUploadAvatar()
  const updateCrop = useUpdateAvatarCrop()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    uploadAvatar.mutate(
      { userId, file },
      {
        onSuccess: ({ avatarUrl }) => {
          setPreview(avatarUrl)
          setCrop(null)
          onUploaded(avatarUrl)
          toast.success('Foto atualizada')
          setEditorOpen(true)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload')
        },
      },
    )
  }

  function handleCropSave(values: CropValues) {
    updateCrop.mutate(
      { userId, ...values },
      {
        onSuccess: () => {
          setCrop(values)
          setEditorOpen(false)
          toast.success('Enquadramento salvo')
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao salvar enquadramento')
        },
      },
    )
  }

  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <EntityImage
          src={preview}
          alt={name}
          shape="circle"
          cropX={crop?.cropX}
          cropY={crop?.cropY}
          cropZoom={crop?.cropZoom}
          className="size-16 border border-slate-200"
          fallback={<span className="text-lg font-semibold text-slate-700">{initials}</span>}
        />
        {preview && (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            aria-label="Ajustar enquadramento"
            className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {uploadAvatar.isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
            <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploadAvatar.isPending}
        >
          {uploadAvatar.isPending ? 'Enviando...' : 'Alterar foto'}
        </Button>
        <p className="text-xs text-slate-400">jpg, png ou webp · máx 2 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {preview && (
        <ImageCropEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={preview}
          shape="circle"
          initial={crop}
          onSave={handleCropSave}
          saving={updateCrop.isPending}
        />
      )}
    </div>
  )
}
