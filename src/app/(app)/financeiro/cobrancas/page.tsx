"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePendingPayments } from "@/hooks/financial/use-checkout";
import { RegisterPaymentModal } from "@/components/domain/financial/register-payment-modal";
import type { Appointment } from "@/hooks/scheduling/use-appointments";

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CobrancasPage() {
  const { data: appointments = [], isLoading } = usePendingPayments();
  const [selected, setSelected] = useState<Appointment | null>(null);

  if (isLoading) return (
    <div className="mx-auto max-w-2xl space-y-4">
      {[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Cobranças pendentes</h1>
        <p className="mt-1 text-sm text-slate-500">{appointments.length} atendimento{appointments.length !== 1 ? "s" : ""} aguardando pagamento</p>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-sm font-medium text-emerald-700">Nenhuma cobrança pendente 🎉</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-white/80 bg-white/85 shadow-sm">
          {(appointments as Appointment[]).map((a) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800">{a.customer.name}</p>
                <p className="text-xs text-slate-400">
                  {a.service.name} · {new Date(a.startsAt).toLocaleDateString("pt-BR")} · {daysSince(a.startsAt)}d atrás
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">{fmt(Number(a.price))}</span>
                <Badge className={a.paymentStatus === "DEBT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                  {a.paymentStatus === "DEBT" ? "Inadimplente" : "Pendente"}
                </Badge>
                <Button size="sm" onClick={() => setSelected(a)}>Cobrar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RegisterPaymentModal
        appointment={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
