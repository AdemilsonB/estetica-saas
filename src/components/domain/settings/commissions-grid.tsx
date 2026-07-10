"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommissions, useUpsertCommission, useApplyCommissionToRole } from "@/hooks/settings/use-commissions";
import { useRoles } from "@/hooks/iam/use-roles";
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

type Props = { readOnly?: boolean };

export function CommissionsGrid({ readOnly = false }: Props) {
  const { data: commissions = [] } = useCommissions();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: professionals = [] } = useQuery({ queryKey: ["professionals"], queryFn: fetchProfessionals });
  const { data: roles = [] } = useRoles();
  const upsert = useUpsertCommission();
  const applyToRole = useApplyCommissionToRole();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [bulkRoleId, setBulkRoleId] = useState<string>("");
  const [bulkRate, setBulkRate] = useState<string>("");

  function getCellKey(serviceId: string, professionalId: string) {
    return `${serviceId}:${professionalId}`;
  }

  function getCommittedRate(serviceId: string, professionalId: string): string {
    const found = commissions.find(
      (c: { serviceId: string; professionalId: string; rate: number }) =>
        c.serviceId === serviceId && c.professionalId === professionalId,
    );
    return found ? String(Number(found.rate)) : "";
  }

  function getCellValue(serviceId: string, professionalId: string): string {
    const key = getCellKey(serviceId, professionalId);
    return key in localValues ? localValues[key] : getCommittedRate(serviceId, professionalId);
  }

  function handleChange(serviceId: string, professionalId: string, value: string) {
    setLocalValues((prev) => ({ ...prev, [getCellKey(serviceId, professionalId)]: value }));
  }

  function handleBlur(serviceId: string, professionalId: string, value: string) {
    setLocalValues((prev) => {
      const next = { ...prev };
      delete next[getCellKey(serviceId, professionalId)];
      return next;
    });
    if (value === "") return;
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    upsert.mutate(
      { serviceId, professionalId, rate: parsed },
      { onError: () => toast.error("Erro ao salvar comissão") },
    );
  }

  function handleApplyToRole() {
    const parsed = parseFloat(bulkRate);
    if (!bulkRoleId || isNaN(parsed) || parsed < 0 || parsed > 100) return;
    applyToRole.mutate(
      { roleId: bulkRoleId, rate: parsed },
      {
        onSuccess: ({ applied }) => {
          toast.success(applied > 0 ? `Comissão aplicada a ${applied} combinação(ões)` : "Ninguém desse cargo tem serviço vinculado");
          setBulkRate("");
        },
        onError: () => toast.error("Erro ao aplicar comissão ao cargo"),
      },
    );
  }

  if (!services.length || !professionals.length) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="min-w-40 flex-1 space-y-1">
            <p className="text-xs font-medium text-slate-500">Aplicar a todos do cargo</p>
            <Select value={bulkRoleId} onValueChange={setBulkRoleId}>
              <SelectTrigger><SelectValue placeholder="Escolha um cargo..." /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="%"
            className="w-20"
            value={bulkRate}
            onChange={(e) => setBulkRate(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={!bulkRoleId || !bulkRate || applyToRole.isPending}
            onClick={handleApplyToRole}
          >
            {applyToRole.isPending ? "Aplicando..." : "Aplicar"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Comissões por profissional × serviço (%)</p>
        <div
          className="overflow-x-auto rounded-xl border border-white/80 bg-white/85"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
          }}
        >
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
                          disabled={readOnly}
                          className="h-8 w-16 text-center"
                          style={{ fontSize: '16px' }}
                          value={getCellValue(s.id, p.id)}
                          placeholder="—"
                          onChange={(e) => handleChange(s.id, p.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => handleBlur(s.id, p.id, e.target.value)}
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
    </div>
  );
}
