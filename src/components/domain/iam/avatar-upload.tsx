'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useUploadAvatar } from '@/hooks/iam/use-team'

type Props = {
  userId: string
  currentAvatarUrl: string | null
  name: string
  onUploaded: (url: string) => void
}

export function AvatarUpload({ userId, currentAvatarUrl, name, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl)
  const uploadAvatar = useUploadAvatar()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    uploadAvatar.mutate(
      { userId, file },
      {
        onSuccess: ({ avatarUrl }) => {
          onUploaded(avatarUrl)
          toast.success('Foto atualizada')
        },
        onError: (err) => {
          setPreview(currentAvatarUrl)
          toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload')
        },
      },
    )
  }

  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {preview ? (
          <img
            src={preview}
            alt={name}
            className="size-16 rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-700">
            {initials}
          </div>
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
    </div>
  )
}
