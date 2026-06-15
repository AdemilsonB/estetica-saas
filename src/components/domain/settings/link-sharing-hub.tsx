'use client'

import { useState, useRef } from 'react'
import QRCode from 'react-qr-code'
import { Copy, Check, ExternalLink, QrCode, MessageCircle, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  slug: string
  baseUrl: string
}

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível (contexto não-seguro ou permissão negada)
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copiado!' : label}
    </Button>
  )
}

function downloadQRCode(slug: string, container: HTMLDivElement | null) {
  if (!container) return
  const svgEl = container.querySelector('svg')
  if (!svgEl) return
  const svgData = new XMLSerializer().serializeToString(svgEl)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const img = new Image()
  img.onload = () => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 512)
    ctx.drawImage(img, 0, 0, 512, 512)
    const a = document.createElement('a')
    a.download = `qrcode-${slug}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
}

export function LinkSharingHub({ slug, baseUrl }: Props) {
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const url = `${baseUrl}/agendar/${slug}`
  const whatsappText = `Olá! Agora você pode agendar online comigo pelo link abaixo. É rápido e fácil! 👇\n${url}`
  const whatsappDeepLink = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`

  return (
    <div className="space-y-6">
      {/* URL pública */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="size-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">Link de agendamento</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700">
            {url}
          </p>
          <CopyButton text={url} />
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Abrir
            </a>
          </Button>
        </div>
      </section>

      {/* QR Code */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">QR Code</p>
        </div>
        <p className="text-xs text-slate-500">Perfeito para imprimir em cartão de visita ou exibir na recepção.</p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div ref={qrContainerRef} className="rounded-xl border border-slate-200 bg-white p-3">
            <QRCode value={url} size={128} />
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadQRCode(slug, qrContainerRef.current)} className="gap-1.5">
            Baixar PNG (alta resolução)
          </Button>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-800">Compartilhar no WhatsApp</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-line">
          {whatsappText}
        </div>
        <div className="flex gap-2">
          <CopyButton text={whatsappText} label="Copiar texto" />
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
            <a href={whatsappDeepLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-3.5" />
              Abrir no WhatsApp
            </a>
          </Button>
        </div>
      </section>

      {/* Instagram */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Link className="size-4 text-pink-500" />
          <p className="text-sm font-semibold text-slate-800">Instagram</p>
        </div>
        <p className="text-xs text-slate-500">Coloque este link na bio do seu perfil.</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700">
            {url}
          </p>
          <CopyButton text={url} />
        </div>
        <p className="text-xs text-slate-400">💡 Nos Stories, use o adesivo "Link" e cole este endereço.</p>
      </section>
    </div>
  )
}
