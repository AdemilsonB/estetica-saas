'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { AtSign, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  initial: {
    bio: string | null
    instagramUrl: string | null
    coverImageUrl: string | null
    phone: string | null
    whatsappEnabled: boolean
  }
}

export function PublicPageForm({ initial }: Props) {
  const [bio, setBio] = useState(initial.bio ?? '')
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await fetch('/api/iam/tenant/cover-image', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Erro no upload')
      const data = (await res.json()) as { coverImageUrl: string }
      setCoverImageUrl(data.coverImageUrl)
      toast.success('Foto de capa atualizada')
    } catch {
      toast.error('Falha no upload da foto de capa')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/iam/tenant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: bio || null,
          instagramUrl: instagramUrl || null,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Página pública atualizada')
    } catch {
      toast.error('Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const whatsappPreview = initial.phone
    ? `wa.me/55${initial.phone.replace(/\D/g, '')}`
    : null

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Foto de capa */}
      <div className="space-y-2">
        <Label>Foto de capa</Label>
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt="Capa"
            className="h-24 w-full rounded-lg object-cover"
          />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          ref={fileRef}
          onChange={handleCoverUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4 mr-1.5" />
          {uploading ? 'Enviando...' : 'Enviar foto'}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPG ou WebP · máx 5MB · ideal 1200×400px</p>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <Label htmlFor="pub-bio">Bio do negócio</Label>
        <Textarea
          id="pub-bio"
          placeholder="Conte sobre seu negócio em até 280 caracteres..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/280</p>
      </div>

      {/* Instagram */}
      <div className="space-y-1.5">
        <Label htmlFor="pub-instagram" className="flex items-center gap-1.5">
          <AtSign className="size-3.5" />
          Instagram
        </Label>
        <Input
          id="pub-instagram"
          type="url"
          placeholder="https://instagram.com/seunegocio"
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
        />
      </div>

      {/* WhatsApp — preview readonly */}
      {whatsappPreview && (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-sm">WhatsApp (gerado automaticamente)</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            {whatsappPreview}
          </div>
          <p className="text-xs text-muted-foreground">
            Gerado a partir do telefone do negócio. Para alterar, edite &quot;Dados do negócio&quot;.
          </p>
        </div>
      )}

      <Button type="submit" disabled={saving} className="rounded-full">
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}
