import Image from 'next/image'
import Link from 'next/link'

interface LandingFooterProps {
  whatsappNumber?: string
}

export function LandingFooter({ whatsappNumber }: LandingFooterProps) {
  const year = new Date().getFullYear()
  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}`
    : null

  return (
    <footer className="bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
      <div className="mb-4 flex items-center justify-center gap-2">
        <Image
          src="/brand/logo-mark.png"
          alt=""
          width={512}
          height={512}
          className="h-8 w-8"
        />
        <span className="text-lg font-extrabold text-white">Agendê</span>
      </div>
      <div className="mb-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
        <Link href="/planos" className="transition-colors hover:text-white">
          Planos
        </Link>
        <Link href="/termos" className="transition-colors hover:text-white">
          Termos de Uso
        </Link>
        <Link href="/privacidade" className="transition-colors hover:text-white">
          Política de Privacidade
        </Link>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            Falar no WhatsApp
          </a>
        )}
      </div>
      <p>© {year} Agendê · Todos os direitos reservados</p>
    </footer>
  )
}
