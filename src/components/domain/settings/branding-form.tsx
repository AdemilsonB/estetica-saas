'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

type Props = {
  initial: BrandingConfig
}

const FONTS = [
  { slug: 'inter', label: 'Inter' },
  { slug: 'manrope', label: 'Manrope' },
  { slug: 'geist', label: 'Geist' },
  { slug: 'dm-sans', label: 'DM Sans' },
  { slug: 'plus-jakarta-sans', label: 'Plus Jakarta Sans' },
  { slug: 'lato', label: 'Lato' },
]

const RADIUS_OPTIONS = [
  { value: 'none', label: 'Sem arredondamento' },
  { value: 'medium', label: 'Médio' },
  { value: 'full', label: 'Totalmente arredondado' },
]

const RADIUS_MAP: Record<string, string> = {
  none: '0rem',
  medium: '0.625rem',
  full: '1.5rem',
}

function applyPreview(field: string, value: string) {
  if (field === 'borderRadius') {
    document.documentElement.style.setProperty('--radius', RADIUS_MAP[value] ?? '0.625rem')
    return
  }
  if (field === 'fontFamily') {
    const varMap: Record<string, string> = {
      inter: 'var(--font-inter)',
      manrope: 'var(--font-manrope)',
      geist: 'var(--font-geist-sans)',
      'dm-sans': 'var(--font-dm-sans)',
      'plus-jakarta-sans': 'var(--font-plus-jakarta-sans)',
      lato: 'var(--font-lato)',
    }
    document.documentElement.style.setProperty('--font-sans', varMap[value] ?? 'var(--font-inter)')
    return
  }
  if (field === 'colorScheme') {
    if (value === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    return
  }
  // Para cores, aplica o hex diretamente como preview imediato (conversão oklch ocorre no save via SSR)
  document.documentElement.style.setProperty(
    `--${field.replace(/Color$/, '').replace(/([A-Z])/g, '-$1').toLowerCase()}`,
    value
  )
}

export function BrandingForm({ initial }: Props) {
  const [config, setConfig] = useState<BrandingConfig>(initial)
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof BrandingConfig>(field: K, value: BrandingConfig[K]) {
    setConfig((prev) => ({ ...prev, [field]: value }))
    applyPreview(field, value as string)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo excede 2MB.')
      return
    }
    setPendingLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function removeLogo() {
    setPendingLogoFile(null)
    setLogoPreview(null)
    setConfig((prev) => ({ ...prev, logoUrl: null }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      let logoUrl = config.logoUrl

      if (pendingLogoFile) {
        const fd = new FormData()
        fd.append('logo', pendingLogoFile)
        const uploadRes = await fetch('/api/iam/branding/logo', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error('Falha no upload do logo.')
        const { logoUrl: uploaded } = (await uploadRes.json()) as { logoUrl: string }
        logoUrl = uploaded
      }

      const res = await fetch('/api/iam/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, logoUrl }),
      })

      if (!res.ok) throw new Error('Falha ao salvar configurações.')

      setConfig((prev) => ({ ...prev, logoUrl }))
      setPendingLogoFile(null)
      toast.success('Configurações salvas com sucesso.')
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Logo */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Identidade visual</h3>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo"
              className="h-16 w-16 rounded-lg object-contain border border-slate-200"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400">
              <Upload className="size-5" />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {logoPreview ? 'Trocar' : 'Enviar logo'}
            </Button>
            {logoPreview && (
              <Button variant="ghost" size="sm" onClick={removeLogo}>
                <X className="size-4" />
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
        <p className="text-xs text-slate-500">PNG, JPG ou SVG · máx 2MB</p>
      </section>

      {/* Cores */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Cores</h3>
        {(
          [
            { field: 'primaryColor', label: 'Cor primária' },
            { field: 'secondaryColor', label: 'Cor secundária' },
            { field: 'accentColor', label: 'Cor accent' },
            { field: 'backgroundColor', label: 'Cor de fundo' },
          ] as const
        ).map(({ field, label }) => (
          <div key={field} className="flex items-center gap-3">
            <input
              type="color"
              value={config[field]}
              onChange={(e) => update(field, e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-slate-200"
            />
            <Label className="w-36 text-sm text-slate-700">{label}</Label>
            <input
              type="text"
              value={config[field]}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) update(field, e.target.value)
                  else setConfig((prev) => ({ ...prev, [field]: e.target.value }))
                }
              }}
              className="w-28 rounded-md border border-slate-200 px-2 py-1 font-mono text-sm"
            />
          </div>
        ))}
      </section>

      {/* Tipografia */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Tipografia</h3>
        <Select value={config.fontFamily} onValueChange={(v) => update('fontFamily', v)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.slug} value={f.slug}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Border radius */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Forma dos elementos</h3>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={config.borderRadius === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => update('borderRadius', opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </section>

      {/* Modo de cor */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Modo de cor</h3>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((scheme) => (
            <Button
              key={scheme}
              variant={config.colorScheme === scheme ? 'default' : 'outline'}
              size="sm"
              onClick={() => update('colorScheme', scheme)}
            >
              {scheme === 'light' ? '☀ Claro' : '☾ Escuro'}
            </Button>
          ))}
        </div>
      </section>

      {/* Save */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
        {isSaving ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar alterações'
        )}
      </Button>
    </div>
  )
}
