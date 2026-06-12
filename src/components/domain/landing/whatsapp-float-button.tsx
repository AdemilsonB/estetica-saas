'use client'

interface WhatsAppFloatButtonProps {
  phoneNumber: string
}

export function WhatsAppFloatButton({ phoneNumber }: WhatsAppFloatButtonProps) {
  const href = `https://wa.me/${phoneNumber}`

  return (
    <div className="fixed bottom-7 right-7 z-50 flex flex-col items-end gap-2">
      {/* Tooltip */}
      <div className="relative rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white shadow-lg">
        Fale conosco pelo WhatsApp
        <span className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 bg-slate-800" />
      </div>

      {/* Botão */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco pelo WhatsApp"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] shadow-lg shadow-green-400/40 transition-transform hover:scale-110 animate-pulse-slow"
      >
        {/* Ícone WhatsApp SVG */}
        <svg viewBox="0 0 32 32" className="h-7 w-7 fill-white">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 2.822.736 5.47 2.027 7.773L0 32l8.49-2.009A15.938 15.938 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm8.086 22.343c-.338.95-1.96 1.82-2.72 1.937-.696.108-1.58.153-2.548-.16-.588-.19-1.343-.444-2.31-.87-4.065-1.754-6.716-5.85-6.916-6.12-.2-.27-1.63-2.165-1.63-4.13 0-1.964 1.03-2.927 1.396-3.325.366-.398.8-.497 1.067-.497.266 0 .533.003.767.014.246.012.576-.093.9.688.338.8 1.15 2.766 1.25 2.967.1.2.167.434.033.7-.133.266-.2.434-.4.667-.2.233-.42.52-.6.7-.2.2-.408.416-.175.816.233.4 1.035 1.708 2.222 2.766 1.526 1.36 2.81 1.78 3.21 1.98.4.2.633.167.867-.1.233-.267 1-1.167 1.267-1.567.266-.4.533-.333.9-.2.367.133 2.333 1.1 2.733 1.3.4.2.667.3.767.466.1.167.1.967-.238 1.968z" />
        </svg>

        {/* Badge decorativo */}
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          1
        </span>
      </a>
    </div>
  )
}
