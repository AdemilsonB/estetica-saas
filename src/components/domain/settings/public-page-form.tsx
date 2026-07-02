'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { AtSign, Upload, MapPin, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  initial: {
    bio: string | null
    instagramUrl: string | null
    coverImageUrl: string | null
    phone: string | null
    whatsappContactEnabled: boolean
    googleBusinessUrl: string | null
  }
}

export function PublicPageForm({ initial }: Props) {
  const [bio, setBio] = useState(initial.bio ?? '')
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl ?? '')
  const [whatsappOn, setWhatsappOn] = useState(initial.whatsappContactEnabled)
  const [googleUrl, setGoogleUrl] = useState(initial.googleBusinessUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
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
      toast.error('Falha no upload. Tente novamente.')
      // resetar o input para permitir nova tentativa
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveCover() {
    setRemoving(true)
    try {
      const res = await fetch('/api/iam/tenant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImageUrl: null }),
      })
      if (!res.ok) throw new Error('Erro ao remover')
      setCoverImageUrl('')
      if (fileRef.current) fileRef.current.value = ''
      toast.success('Foto de capa removida')
    } catch {
      toast.error('Falha ao remover foto')
    } finally {
      setRemoving(false)
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
          whatsappContactEnabled: whatsappOn,
          googleBusinessUrl: googleUrl || null,
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

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Foto de capa */}
      <div className="space-y-2">
        <Label>Foto de capa</Label>
        {coverImageUrl ? (
          <div className="relative overflow-hidden rounded-lg">
            {/* Proporção 3:1 simula como aparece na vitrine em qualquer largura */}
            <div className="relative w-full" style={{ paddingBottom: '33.33%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageUrl}
                alt="Capa"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        ) : (
          <div className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 py-8 text-xs text-muted-foreground">
            Nenhuma foto de capa
          </div>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          ref={fileRef}
          onChange={handleCoverUpload}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || removing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4 mr-1.5" />
            {uploading ? 'Enviando...' : 'Enviar foto'}
          </Button>
          {coverImageUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removing || uploading}
              onClick={handleRemoveCover}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4 mr-1.5" />
              {removing ? 'Removendo...' : 'Remover foto'}
            </Button>
          )}
        </div>
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

      {/* Contato e redes */}
      <div className="space-y-4">
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

        {/* WhatsApp — toggle */}
        {initial.phone && (
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="wa-toggle">Mostrar WhatsApp na página</Label>
              <p className="text-xs text-muted-foreground">
                Botão de contato via {`wa.me/55${initial.phone.replace(/\D/g, '')}`}
              </p>
            </div>
            <Switch id="wa-toggle" checked={whatsappOn} onCheckedChange={setWhatsappOn} />
          </div>
        )}

        {/* Google Maps */}
        <div className="space-y-1.5">
          <Label htmlFor="pub-google" className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            Google Maps
          </Label>
          <Input
            id="pub-google"
            type="url"
            placeholder="https://www.google.com/maps/place/seu-negocio"
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Cole o link do seu perfil no Google Maps para exibir o botão &quot;Ver no Google&quot;.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="rounded-full">
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}
