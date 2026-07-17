// src/components/domain/landing/landing-footer.tsx
import Image from 'next/image'
import Link from 'next/link'

interface LandingFooterProps {
  whatsappNumber?: string
}

export function LandingFooter({ whatsappNumber }: LandingFooterProps) {
  const year = new Date().getFullYear()
  const waHref = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}` : null

  return (
    <footer className="bg-slate-900 px-4 py-12 text-sm text-slate-400 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Image src="/brand/logo-mark.png" alt="" width={512} height={512} className="h-8 w-8" />
              <span className="font-display text-lg font-extrabold text-white">Agendê</span>
            </div>
            <p className="max-w-xs leading-relaxed">
              O piloto automático de salões, barbearias e clínicas. Menos telefone tocando, mais
              cadeira ocupada.
            </p>
          </div>

          <div>
            <div className="mb-3 font-extrabold text-white">Produto</div>
            <ul className="flex flex-col gap-2">
              <li><Link href="#funcionalidades" className="transition-colors hover:text-white">Funcionalidades</Link></li>
              <li><Link href="#como-funciona" className="transition-colors hover:text-white">Como funciona</Link></li>
              <li><Link href="#planos" className="transition-colors hover:text-white">Planos e preços</Link></li>
              <li><Link href="#demo" className="transition-colors hover:text-white">Demonstração</Link></li>
            </ul>
          </div>

          <div>
            <div className="mb-3 font-extrabold text-white">Empresa</div>
            <ul className="flex flex-col gap-2">
              <li><Link href="#depoimentos" className="transition-colors hover:text-white">Depoimentos</Link></li>
              {waHref && (
                <li>
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
                    Falar no WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <div className="mb-3 font-extrabold text-white">Legal</div>
            <ul className="flex flex-col gap-2">
              <li><Link href="/termos" className="transition-colors hover:text-white">Termos de Uso</Link></li>
              <li><Link href="/privacidade" className="transition-colors hover:text-white">Privacidade (LGPD)</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 sm:flex-row">
          <span>© {year} Agendê · Todos os direitos reservados.</span>
          <span>Feito no Brasil 🇧🇷 para quem vive de atender bem.</span>
        </div>
      </div>
    </footer>
  )
}
