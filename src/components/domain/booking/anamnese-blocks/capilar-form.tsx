'use client'

import { useState } from 'react'
import { type ReactElement } from 'react'
import { ChevronLeft, Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'

type SubStep = 'comprimento' | 'historico' | 'cuidados' | 'fotos' | 'objetivo'
const SUB_STEPS: SubStep[] = ['comprimento', 'historico', 'cuidados', 'fotos', 'objetivo']

type QuandoVal = 'menos_30_dias' | '30_90_dias' | '3_6_meses' | 'mais_6_meses'
type QuimicaItem = { feito: boolean; quando?: QuandoVal }

const QUANDOS: { value: QuandoVal; label: string }[] = [
  { value: 'menos_30_dias', label: '< 30 dias' },
  { value: '30_90_dias',    label: '30–90 dias' },
  { value: '3_6_meses',     label: '3–6 meses' },
  { value: 'mais_6_meses',  label: '+ 6 meses' },
]

type Props = {
  tenantSlug: string
  initial?: CapilarBlock
  primaryColor: string
  onComplete: (data: CapilarBlock) => void
  onBack: () => void
  onSkip?: () => void
}

type PhotoPosition = 'photoFront' | 'photoSide' | 'photoBack'
type UploadingState = Record<PhotoPosition, boolean>

const PHOTO_SLOTS: { key: PhotoPosition; label: string; hint: string; svg: ReactElement }[] = [
  {
    key: 'photoFront',
    label: 'Frente',
    hint: 'Vista frontal',
    svg: (
      <svg viewBox="0 0 80 100" fill="currentColor" aria-hidden>
        {/* coroa */}
        <path d="M40 4C28 4 18 12 18 24v4c4-10 12-16 22-16s18 6 22 16v-4C62 12 52 4 40 4Z" />
        {/* lateral esquerda */}
        <path d="M18 28C14 38 12 56 14 74c2 16 6 26 10 30-2-12-4-28-4-44 0-14 2-22 -2-32Z" />
        {/* lateral direita */}
        <path d="M62 28C66 38 68 56 66 74c-2 16-6 26-10 30 2-12 4-28 4-44 0-14-2-22 2-32Z" />
        {/* cabeça */}
        <ellipse cx="40" cy="38" rx="20" ry="26" />
      </svg>
    ),
  },
  {
    key: 'photoSide',
    label: 'Lado',
    hint: 'Vista lateral',
    svg: (
      <svg viewBox="0 0 80 100" fill="currentColor" aria-hidden>
        {/* cabelo topo/atrás fluindo */}
        <path d="M44 6C34 6 24 10 20 20c-2 6-2 14-2 20 0 8 1 16 2 24 2 12 4 22 6 28C24 80 22 62 22 46c0-16 4-28 14-34 4-2 8-4 12-6H44Z" />
        {/* perfil da cabeça */}
        <path d="M44 8c10 0 18 8 18 22 0 12-6 22-16 26v8c14-4 22-16 22-34C68 16 58 6 44 6v2Z" />
        {/* rosto */}
        <ellipse cx="46" cy="34" rx="16" ry="22" />
      </svg>
    ),
  },
  {
    key: 'photoBack',
    label: 'Atrás',
    hint: 'Vista posterior',
    svg: (
      <svg viewBox="0 0 80 100" fill="currentColor" aria-hidden>
        {/* cabelo fluindo reto */}
        <path d="M22 30C18 42 16 62 18 80c2 10 4 16 6 18-2-10-2-26-2-40 0-14 2-22 0-28Z" />
        <path d="M58 30C62 42 64 62 62 80c-2 10-4 16-6 18 2-10 2-26 2-40 0-14-2-22 0-28Z" />
        <path d="M22 60C24 78 26 90 28 98h24c2-8 4-20 6-38H22Z" />
        {/* parte de cima */}
        <path d="M22 30C24 16 32 8 40 8s16 8 18 22C52 18 46 14 40 14s-12 4-18 16Z" />
        {/* cabeça (vista de costas) */}
        <ellipse cx="40" cy="30" rx="18" ry="22" />
      </svg>
    ),
  },
]

export function CapilarForm({ tenantSlug, initial, primaryColor, onComplete, onBack, onSkip }: Props) {
  const [subStep, setSubStep] = useState<SubStep>('comprimento')
  const [uploading, setUploading] = useState<UploadingState>({ photoFront: false, photoSide: false, photoBack: false })
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [data, setData] = useState<CapilarBlock>({
    produtos: [],
    objetivos: [],
    ...initial,
  })

  const subIdx = SUB_STEPS.indexOf(subStep)
  const isFirst = subIdx === 0
  const isLast = subIdx === SUB_STEPS.length - 1

  function goNext() {
    if (isLast) {
      onComplete(data)
    } else {
      setSubStep(SUB_STEPS[subIdx + 1]!)
    }
  }

  function goPrev() {
    if (isFirst) {
      onBack()
    } else {
      setSubStep(SUB_STEPS[subIdx - 1]!)
    }
  }

  function setQuimica(key: keyof Pick<CapilarBlock, 'coloracao'|'descoloracao'|'progressiva'|'botox'>, item: QuimicaItem) {
    setData((d) => ({ ...d, [key]: item }))
  }

  function toggleObjetivo(obj: NonNullable<CapilarBlock['objetivos']>[number]) {
    setData((d) => {
      const list = d.objetivos ?? []
      return {
        ...d,
        objetivos: list.includes(obj) ? list.filter((o) => o !== obj) : [...list, obj],
      }
    })
  }

  async function uploadFoto(position: PhotoPosition, file: File) {
    setUploading((u) => ({ ...u, [position]: true }))
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/public/${tenantSlug}/anamnese/upload`, { method: 'POST', body: formData })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) { setUploadError(json.error ?? 'Erro no upload'); return }
      setData((d) => ({ ...d, [position]: json.url! }))
    } catch { setUploadError('Erro de conexão.') }
    finally { setUploading((u) => ({ ...u, [position]: false })) }
  }

  function removePhoto(position: PhotoPosition) {
    setData((d) => ({ ...d, [position]: undefined }))
  }

  const btnSelected = { borderColor: primaryColor, backgroundColor: `${primaryColor}18`, color: primaryColor }
  const chipBase = 'p-2.5 rounded-lg border text-sm text-left transition-colors'
  const chipIdle = 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'

  const stepTitle: Record<SubStep, string> = {
    comprimento: 'Comprimento e tipo de fio',
    historico:   'Histórico de químicas',
    cuidados:    'Cuidados em casa',
    fotos:       'Fotos do cabelo',
    objetivo:    'O que você quer?',
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Indicador de progresso */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {SUB_STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= subIdx ? '' : 'bg-slate-200'}`}
              style={i <= subIdx ? { backgroundColor: primaryColor } : {}} />
          ))}
        </div>
        <p className="text-xs text-slate-500">Passo {subIdx + 1} de {SUB_STEPS.length} — {stepTitle[subStep]}</p>
      </div>

      <button onClick={goPrev} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1">
        <ChevronLeft className="size-4" />
        {isFirst ? 'Voltar' : 'Anterior'}
      </button>

      {/* Sub-seção A: Comprimento */}
      {subStep === 'comprimento' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Comprimento atual</h2>
            <p className="text-sm text-slate-500 mt-0.5">Como está seu cabelo hoje?</p>
          </div>
          <div className="space-y-2">
            {[
              { value: 'nuca', label: 'Nuca' },
              { value: 'ombro', label: 'Ombro' },
              { value: 'meio_costas', label: 'Meio das costas' },
              { value: 'cintura', label: 'Cintura' },
              { value: 'mais_cintura', label: 'Além da cintura' },
            ].map((opt) => (
              <button key={opt.value} onClick={() => setData((d) => ({ ...d, comprimento: opt.value as CapilarBlock['comprimento'] }))}
                className={`w-full flex items-center p-3 rounded-xl border text-left text-sm font-medium transition-colors ${data.comprimento === opt.value ? 'border-2' : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'}`}
                style={data.comprimento === opt.value ? btnSelected : {}}>
                {opt.label}
              </button>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Tipo de fio</p>
            <div className="grid grid-cols-2 gap-2">
              {(['liso','ondulado','cacheado','crespo'] as const).map((v) => (
                <button key={v} onClick={() => setData((d) => ({ ...d, tipoFio: v }))}
                  className={`${chipBase} ${data.tipoFio === v ? 'border-2 font-medium' : chipIdle} capitalize`}
                  style={data.tipoFio === v ? { borderColor: primaryColor, color: primaryColor } : {}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-seção B: Histórico */}
      {subStep === 'historico' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Histórico de químicas</h2>
            <p className="text-sm text-slate-500 mt-0.5">Marque o que você já fez e quando.</p>
          </div>
          {([
            { key: 'coloracao' as const, label: 'Coloração' },
            { key: 'descoloracao' as const, label: 'Descoloração / luzes' },
            { key: 'progressiva' as const, label: 'Progressiva / alisamento' },
            { key: 'botox' as const, label: 'Botox / selagem' },
          ]).map(({ key, label }) => {
            const item: QuimicaItem = (data[key] as QuimicaItem | undefined) ?? { feito: false }
            return (
              <div key={key} className="space-y-2">
                <button onClick={() => setQuimica(key, { feito: !item.feito, quando: undefined })}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-colors ${item.feito ? 'border-2' : 'border-slate-200 bg-white'}`}
                  style={item.feito ? { borderColor: primaryColor } : {}}>
                  <span className="text-slate-800">{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.feito ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                    style={item.feito ? { backgroundColor: primaryColor } : {}}>
                    {item.feito ? 'Sim' : 'Não'}
                  </span>
                </button>
                {item.feito && (
                  <div className="grid grid-cols-2 gap-1.5 pl-2">
                    {QUANDOS.map((q) => (
                      <button key={q.value} onClick={() => setQuimica(key, { ...item, quando: q.value })}
                        className={`${chipBase} ${item.quando === q.value ? 'border-2 font-medium' : chipIdle}`}
                        style={item.quando === q.value ? { borderColor: primaryColor, color: primaryColor } : {}}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sub-seção C: Cuidados */}
      {subStep === 'cuidados' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cuidados em casa</h2>
            <p className="text-sm text-slate-500 mt-0.5">Sua rotina capilar atual.</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Produtos que você usa</p>
            <div className="flex gap-2">
              <Input id="produto-input" placeholder="Ex: Kerastase, Pantene..." className="text-sm"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const val = (e.currentTarget.value ?? '').trim()
                  if (val && (data.produtos ?? []).length < 10) {
                    setData((d) => ({ ...d, produtos: [...(d.produtos ?? []), val] }))
                    e.currentTarget.value = ''
                  }
                }} />
              <Button variant="outline" size="icon" type="button"
                onClick={() => {
                  const el = document.getElementById('produto-input') as HTMLInputElement | null
                  const val = (el?.value ?? '').trim()
                  if (val && (data.produtos ?? []).length < 10) {
                    setData((d) => ({ ...d, produtos: [...(d.produtos ?? []), val] }))
                    if (el) el.value = ''
                  }
                }}>
                <Plus className="size-4" />
              </Button>
            </div>
            {(data.produtos ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(data.produtos ?? []).map((p) => (
                  <span key={p} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                    {p}
                    <button onClick={() => setData((d) => ({ ...d, produtos: (d.produtos ?? []).filter((x) => x !== p) }))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Frequência de lavagem</p>
            <div className="space-y-1.5">
              {[
                { value: 'diario', label: 'Todo dia' },
                { value: '2_3_semana', label: '2–3x por semana' },
                { value: '1_semana', label: '1x por semana' },
                { value: 'menos_semana', label: 'Menos de 1x por semana' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setData((d) => ({ ...d, frequenciaLavagem: opt.value as CapilarBlock['frequenciaLavagem'] }))}
                  className={`${chipBase} w-full ${data.frequenciaLavagem === opt.value ? 'border-2 font-medium' : chipIdle}`}
                  style={data.frequenciaLavagem === opt.value ? { borderColor: primaryColor, color: primaryColor } : {}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Chapinha / babyliss</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: 'nunca', label: 'Nunca' },
                { value: 'raramente', label: 'Raramente' },
                { value: '2_3_semana', label: '2–3x / semana' },
                { value: 'diario', label: 'Todo dia' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setData((d) => ({ ...d, usoTermico: opt.value as CapilarBlock['usoTermico'] }))}
                  className={`${chipBase} ${data.usoTermico === opt.value ? 'border-2 font-medium' : chipIdle}`}
                  style={data.usoTermico === opt.value ? { borderColor: primaryColor, color: primaryColor } : {}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-seção D: Fotos */}
      {subStep === 'fotos' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Fotos do cabelo</h2>
            <p className="text-sm text-slate-500 mt-0.5">Ajuda o profissional a entender melhor seu cabelo. Opcional.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PHOTO_SLOTS.map((slot) => {
              const url = data[slot.key] as string | undefined
              const isUploading = uploading[slot.key]
              return (
                <div key={slot.key} className="flex flex-col items-center gap-1.5">
                  <p className="text-xs font-medium text-slate-600">{slot.label}</p>
                  {url ? (
                    <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Foto ${slot.label}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(slot.key)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                        aria-label="Remover foto"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="relative w-full aspect-[3/4] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-slate-300 hover:bg-slate-100 transition-colors overflow-hidden">
                      <span className="w-3/4 text-slate-200">{slot.svg}</span>
                      <span className="text-[10px] text-slate-400 mt-1">
                        {isUploading ? (
                          <Loader2 className="size-3.5 animate-spin mx-auto" />
                        ) : (
                          slot.hint
                        )}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFoto(slot.key, f) }}
                      />
                    </label>
                  )}
                </div>
              )
            })}
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <p className="text-xs text-slate-400">JPEG, PNG ou WebP · até 5 MB cada</p>
        </div>
      )}

      {/* Sub-seção E: Objetivo */}
      {subStep === 'objetivo' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">O que você quer?</h2>
            <p className="text-sm text-slate-500 mt-0.5">Selecione tudo que se aplica.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'mudar_cor', label: 'Mudar a cor', emoji: '🎨' },
              { value: 'hidratar', label: 'Hidratar', emoji: '💧' },
              { value: 'alisar', label: 'Alisar', emoji: '✨' },
              { value: 'manutencao', label: 'Manutenção', emoji: '🔄' },
              { value: 'corte', label: 'Corte', emoji: '✂️' },
              { value: 'outro', label: 'Outro', emoji: '🎯' },
            ].map((opt) => {
              const sel = (data.objetivos ?? []).includes(opt.value as never)
              return (
                <button key={opt.value} onClick={() => toggleObjetivo(opt.value as never)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors text-sm ${sel ? 'border-2' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  style={sel ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : {}}>
                  <span>{opt.emoji}</span>
                  <span className="font-medium" style={sel ? { color: primaryColor } : { color: '#374151' }}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Descreva mais (opcional)</p>
            <Textarea value={data.descricaoLivre ?? ''} onChange={(e) => setData((d) => ({ ...d, descricaoLivre: e.target.value }))}
              placeholder="Ex: quero manter o comprimento mas mudar a cor..." maxLength={500} rows={3} className="text-sm resize-none" />
          </div>
        </div>
      )}

      {/* Barra de ação fixa na base */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
          <Button
            onClick={goNext}
            className="w-full"
            size="lg"
            style={{ backgroundColor: primaryColor }}
            disabled={subStep === 'objetivo' && (data.objetivos ?? []).length === 0}
          >
            {isLast ? 'Concluir ficha' : 'Próximo →'}
          </Button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-600 py-1"
            >
              Pular preenchimento da ficha
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
