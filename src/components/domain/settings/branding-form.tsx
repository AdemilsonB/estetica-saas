'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hexToOklchStr } from '@/lib/branding/build-css-variables'

type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  backgroundColor: string
  borderColor: string
  foregroundColor: string
  mutedColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

type Props = {
  initial: {
    logoUrl: string | null
    primaryColor: string
    accentColor: string
    backgroundColor: string
    borderColor: string
    foregroundColor: string
    mutedColor: string
    fontFamily: string
    borderRadius: string
    colorScheme: string
    [key: string]: unknown
  }
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

const WARM_DEFAULTS = {
  primaryColor: '#c8916a',
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
}

const RADIUS_MAP: Record<string, string> = {
  none: '0rem',
  medium: '0.625rem',
  full: '1.5rem',
}

function toRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function BrandingPreview({
  primaryColor,
  backgroundColor,
}: {
  primaryColor: string
  backgroundColor: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden select-none text-[11px]">
      <div className="border-b border-white/70 bg-white/80 px-3 py-2 backdrop-blur">
        <p className="font-bold uppercase tracking-widest" style={{ color: primaryColor, fontSize: '9px' }}>
          Workspace operacional
        </p>
        <p className="text-xs font-semibold text-slate-900">Olá, João</p>
      </div>
      <div className="flex" style={{ backgroundColor, minHeight: '96px' }}>
        <div className="w-24 flex-shrink-0 border-r border-white/70 bg-white/75 p-2 flex flex-col gap-1">
          <div
            className="flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{ backgroundColor: toRgba(primaryColor, 0.1) }}
          >
            <span
              className="flex size-4 items-center justify-center rounded text-[9px]"
              style={{ backgroundColor: toRgba(primaryColor, 0.18), color: primaryColor }}
            >
              📅
            </span>
            <span className="text-[9px] font-semibold" style={{ color: primaryColor }}>
              Agenda
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1">
            <span className="flex size-4 items-center justify-center rounded bg-slate-100 text-[9px]">👥</span>
            <span className="text-[9px] text-slate-500">Clientes</span>
          </div>
        </div>
        <div className="flex-1 p-2">
          <p className="mb-1.5 font-semibold text-slate-900" style={{ fontSize: '10px' }}>
            Dashboard
          </p>
          <span
            className="rounded-md px-2 py-0.5 text-[9px] font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            + Novo agendamento
          </span>
        </div>
      </div>
    </div>
  )
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
  // mutedColor → --muted-foreground (exceção: não segue o padrão automático)
  if (field === 'mutedColor') {
    document.documentElement.style.setProperty('--muted-foreground', hexToOklchStr(value))
    return
  }
  const cssVar = `--${field.replace(/Color$/, '').replace(/([A-Z])/g, '-$1').toLowerCase()}`
  document.documentElement.style.setProperty(cssVar, hexToOklchStr(value))
}

export function BrandingForm({ initial }: Props) {
  const router = useRouter()
  const [config, setConfig] = useState<BrandingConfig>({
    logoUrl: initial.logoUrl,
    primaryColor: initial.primaryColor,
    accentColor: initial.accentColor,
    backgroundColor: initial.backgroundColor,
    borderColor: initial.borderColor,
    foregroundColor: initial.foregroundColor,
    mutedColor: initial.mutedColor,
    fontFamily: initial.fontFamily,
    borderRadius: initial.borderRadius,
    colorScheme: initial.colorScheme,
  })
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
      router.refresh()
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Identidade visual */}
      <section className="space-y-5">
        <h3 className="text-sm font-semibold text-slate-900">Identidade visual</h3>

        {/* Logo */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">Logo</p>
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
          <p className="text-xs text-slate-500">PNG, JPG ou SVG · máx 2MB · aparece no header da agenda online</p>
        </div>

      </section>

      {/* Cores + Prévia lado a lado */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Cores</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                Object.entries(WARM_DEFAULTS).forEach(([field, value]) => {
                  update(field as keyof BrandingConfig, value)
                })
              }}
            >
              Restaurar padrão warm
            </Button>
          </div>

          {[
            { field: 'primaryColor' as const, label: 'Cor da marca', desc: 'Botões, ícones ativos, links' },
            { field: 'backgroundColor' as const, label: 'Fundo da tela', desc: 'Background geral das páginas' },
            { field: 'accentColor' as const, label: 'Fundo de seleção', desc: 'Item ativo na sidebar, hover states' },
            { field: 'borderColor' as const, label: 'Bordas e separadores', desc: 'Cards, dividers, inputs' },
            { field: 'foregroundColor' as const, label: 'Texto principal', desc: 'Títulos e texto de destaque' },
            { field: 'mutedColor' as const, label: 'Texto secundário', desc: 'Descrições, hints, labels' },
          ].map(({ field, label, desc }) => (
            <div key={field} className="flex items-start gap-3">
              <input
                type="color"
                value={config[field]}
                onChange={(e) => update(field, e.target.value)}
                className="mt-1 h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <div className="flex-1 space-y-0.5">
                <Label className="text-sm font-medium text-slate-900">{label}</Label>
                <p className="text-xs text-slate-500">{desc}</p>
                <input
                  type="text"
                  value={config[field]}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        update(field, e.target.value)
                      else setConfig((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                  }}
                  className="w-28 rounded-md border border-slate-200 px-2 py-1 font-mono text-sm"
                />
              </div>
            </div>
          ))}

          {/* Tipografia */}
          <div className="space-y-2">
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
          </div>

          {/* Border radius */}
          <div className="space-y-2">
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
          </div>

          {/* Modo de cor */}
          <div className="space-y-2">
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
          </div>
        </section>

        {/* Prévia ao vivo */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Prévia ao vivo</h3>
          <BrandingPreview
            primaryColor={config.primaryColor}
            backgroundColor={config.backgroundColor}
          />
          <p className="text-xs text-slate-400">
            Atualiza em tempo real conforme você edita as cores.
          </p>
        </section>
      </div>

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
