// src/components/domain/landing/landing-feature-mockups.tsx
// Mockups fiéis (JSX puro) de cada recurso, usados nos blocos de Features.
// Sem dados reais — são ilustrações do produto, contidas e responsivas.

function MockShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-xl shadow-violet-100/50">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
        <span className="ml-2 truncate text-[11px] text-slate-400">{label}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── 1. Agenda online ────────────────────────────────────────────────────────

export function MockAgenda() {
  const slots = [
    { time: '09h', label: 'Ana · Escova', color: 'bg-violet-100 text-violet-700', span: 'row-span-1' },
    { time: '10h', label: 'livre', color: 'bg-slate-50 text-slate-300', span: '' },
    { time: '11h', label: 'Bia · Coloração', color: 'bg-pink-100 text-pink-700', span: '' },
    { time: '14h', label: 'Duda · Corte', color: 'bg-sky-100 text-sky-700', span: '' },
  ]
  return (
    <MockShell label="agend.com.br/agenda">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">Segunda, 30 jun</span>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
          Mariana
        </span>
      </div>
      <div className="space-y-2">
        {slots.map((s) => (
          <div key={s.time} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[11px] font-medium text-slate-400">{s.time}</span>
            <div className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${s.color}`}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-center text-[11px] font-medium text-violet-500">
        + Nova cliente agendou pelo link
      </div>
    </MockShell>
  )
}

// ─── 2. WhatsApp automático (vitrine tech / automação) ───────────────────────

export function MockWhatsApp() {
  const messages = [
    { tag: 'Confirmação', when: 'no agendamento', text: 'Oi Ana! Seu horário de Escova ficou pra segunda às 09h 💜 Está confirmado?' },
    { tag: 'Lembrete 24h', when: '1 dia antes', text: 'Lembrete: amanhã às 09h no Studio Bella. Responda 1 para confirmar.' },
    { tag: 'Follow-up', when: 'pós-atendimento', text: 'Adorou o resultado? Agende seu retorno com 10% off 🎁' },
  ]
  return (
    <MockShell label="fluxo automático · WhatsApp">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs">💬</span>
        <span className="text-sm font-bold text-slate-800">Enviado automaticamente</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> em tempo real
        </span>
      </div>
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={m.tag} className="relative pl-5">
            {i < messages.length - 1 && (
              <span className="absolute left-[7px] top-5 h-full w-px bg-violet-100" />
            )}
            <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-violet-400 bg-white" />
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                {m.tag}
              </span>
              <span className="text-[10px] text-slate-400">{m.when}</span>
            </div>
            <div className="mt-1 rounded-lg rounded-tl-none bg-green-50 px-3 py-2 text-xs leading-snug text-slate-700">
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </MockShell>
  )
}

// ─── 3. Financeiro em tempo real ─────────────────────────────────────────────

export function MockFinanceiro() {
  const bars = [40, 65, 50, 80, 60, 95, 72]
  return (
    <MockShell label="agend.com.br/financeiro">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] text-slate-400">Faturamento do mês</div>
          <div className="text-2xl font-extrabold text-slate-900">R$ 18.420</div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
          ↑ 23%
        </span>
      </div>
      <div className="flex h-20 items-end gap-1.5">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-violet-500 to-pink-400" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { label: 'Comissões · Mariana', value: 'R$ 2.140' },
          { label: 'Produtos vendidos', value: 'R$ 890' },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{r.label}</span>
            <span className="font-semibold text-slate-800">{r.value}</span>
          </div>
        ))}
      </div>
    </MockShell>
  )
}

// ─── 4. Fidelização ──────────────────────────────────────────────────────────

export function MockFidelizacao() {
  return (
    <MockShell label="perfil da cliente">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-base font-bold text-white">
          A
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">Ana Silva</span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              ★ VIP
            </span>
          </div>
          <div className="text-[11px] text-slate-400">Cliente há 2 anos · 34 visitas</div>
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-pink-50 px-3 py-2 text-xs font-medium text-pink-700">
        🎂 Aniversário em 3 dias — enviar mimo automático
      </div>
      <div className="mt-3 space-y-1.5">
        {['Escova + Hidratação · 12 jun', 'Coloração completa · 28 mai', 'Corte + Escova · 05 mai'].map((h) => (
          <div key={h} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
            {h}
          </div>
        ))}
      </div>
    </MockShell>
  )
}

// ─── 5. Anti-falta / lembretes ───────────────────────────────────────────────

export function MockAntiFalta() {
  const rows = [
    { name: 'Ana Silva · 09h', status: 'Confirmado', color: 'bg-emerald-100 text-emerald-700' },
    { name: 'Bia Costa · 11h', status: 'Confirmado', color: 'bg-emerald-100 text-emerald-700' },
    { name: 'Duda Lima · 14h', status: 'Aguardando', color: 'bg-amber-100 text-amber-700' },
    { name: 'Eva Reis · 16h', status: 'Ligar', color: 'bg-red-100 text-red-700' },
  ]
  return (
    <MockShell label="painel de confirmações">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">Amanhã · 4 agendamentos</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
          2 confirmados
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <span className="text-xs font-medium text-slate-700">{r.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.color}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </MockShell>
  )
}
