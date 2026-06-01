"use client";

import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useCommissions, useUpsertCommission } from "@/hooks/settings/use-commissions";
import { useQuery } from "@tanstack/react-query";

async function fetchServices() {
  const res = await fetch("/api/scheduling/services");
  if (!res.ok) throw new Error("Erro");
  return res.json();
}

async function fetchProfessionals() {
  const res = await fetch("/api/iam/users");
  if (!res.ok) throw new Error("Erro");
  return res.json();
}

export function CommissionsGrid() {
  const { data: commissions = [] } = useCommissions();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: professionals = [] } = useQuery({ queryKey: ["professionals"], queryFn: fetchProfessionals });
  const upsert = useUpsertCommission();

  function handleRateChange(serviceId: string, professionalId: string, rate: string) {
    const parsed = parseFloat(rate);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    upsert.mutate(
      { serviceId, professionalId, rate: parsed },
      { onError: () => toast.error("Erro ao salvar comissão") },
    );
  }

  function getRate(serviceId: string, professionalId: string): string {
    const found = commissions.find(
      (c: { serviceId: string; professionalId: string; rate: number }) =>
        c.serviceId === serviceId && c.professionalId === professionalId,
    );
    return found ? String(Number(found.rate)) : "";
  }

  if (!services.length || !professionals.length) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">Comissões por profissional × serviço (%)</p>
      <div className="overflow-x-auto rounded-xl border border-white/80 bg-white/85">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Profissional</th>
              {services.map((s: { id: string; name: string }) => (
                <th key={s.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-500">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {professionals
              .filter((p: { role: string }) => p.role === "PROFESSIONAL")
              .map((p: { id: string; name: string }) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                {services.map((s: { id: string }) => (
                  <td key={s.id} className="px-3 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className="h-7 w-16 text-center text-xs"
                      value={getRate(s.id, p.id)}
                      placeholder="—"
                      onBlur={(e) => handleRateChange(s.id, p.id, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Deixe em branco para sem comissão. Salva automaticamente ao sair do campo.</p>
    </div>
  );
}
