import Link from 'next/link'

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
      <div className="mb-3 text-lg font-extrabold text-white">Agendê</div>
      <div className="mb-4 flex justify-center gap-6">
        <Link href="/termos" className="hover:text-white transition-colors">
          Termos de Uso
        </Link>
        <Link href="/privacidade" className="hover:text-white transition-colors">
          Política de Privacidade
        </Link>
      </div>
      <p>© {year} Agendê · Todos os direitos reservados</p>
    </footer>
  )
}
