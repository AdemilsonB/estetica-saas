'use client'

import { useState } from 'react'
import { ChevronLeft, Plus, X, Camera, Loader2 } from 'lucide-react'
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
}

export function CapilarForm({ tenantSlug, initial, primaryColor, onComplete, onBack }: Props) {
  const [subStep, setSubStep] = useState<SubStep>('comprimento')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [data, setData] = useState<CapilarBlock>({
    produtos: [],
    photoUrls: [],
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

  async function uploadFoto(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/public/${tenantSlug}/anamnese/upload`, { method: 'POST', body: formData })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) { setUploadError(json.error ?? 'Erro no upload'); return }
      setData((d) => ({ ...d, photoUrls: [...(d.photoUrls ?? []), json.url!] }))
    } catch { setUploadError('Erro de conexão.') }
    finally { setUploading(false) }
  }

  function removePhoto(url: string) {
    setData((d) => ({ ...d, photoUrls: (d.photoUrls ?? []).filter((u) => u !== url) }))
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
    <div className="space-y-5">
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
          <div className="grid grid-cols-3 gap-2">
            {(data.photoUrls ?? []).map((url) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Foto do cabelo" className="w-full h-full object-cover" />
                <button onClick={() => removePhoto(url)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {(data.photoUrls ?? []).length < 3 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-slate-400 cursor-pointer transition-colors">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                <span className="text-xs">{uploading ? 'Enviando...' : 'Adicionar'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFoto(f) }} />
              </label>
            )}
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <p className="text-xs text-slate-400">Máx. 3 fotos · JPEG, PNG ou WebP · até 5 MB cada</p>
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

      {/* Botão de ação */}
      <Button onClick={goNext} className="w-full" style={{ backgroundColor: primaryColor }}
        disabled={subStep === 'objetivo' && (data.objetivos ?? []).length === 0}>
        {isLast ? 'Concluir ficha' : 'Próximo'}
      </Button>
    </div>
  )
}
