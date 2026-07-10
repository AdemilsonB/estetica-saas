import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchCommissions() {
  const res = await fetch("/api/settings/commissions");
  if (!res.ok) throw new Error("Erro ao buscar comissões");
  return res.json();
}

async function upsertCommission(input: { serviceId: string; professionalId: string; rate: number }) {
  const res = await fetch("/api/settings/commissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar comissão");
  return res.json();
}

async function deleteCommission(id: string) {
  const res = await fetch(`/api/settings/commissions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao remover comissão");
}

async function fetchCardFees() {
  const res = await fetch("/api/settings/card-fees");
  if (!res.ok) throw new Error("Erro ao buscar taxas");
  return res.json();
}

async function saveCardFees(input: { DEBIT_CARD: number; CREDIT_CARD: number }) {
  const res = await fetch("/api/settings/card-fees", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar taxas");
  return res.json();
}

export function useCommissions() {
  return useQuery({ queryKey: ["commissions"], queryFn: fetchCommissions });
}

export function useUpsertCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertCommission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}

export function useDeleteCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCommission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}

export function useCardFees() {
  return useQuery({ queryKey: ["card-fees"], queryFn: fetchCardFees });
}

export function useSaveCardFees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveCardFees,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["card-fees"] }),
  });
}

async function applyCommissionToRole(input: { roleId: string; rate: number }) {
  const res = await fetch("/api/settings/commissions/apply-role", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao aplicar comissão ao cargo");
  return res.json() as Promise<{ applied: number }>;
}

export function useApplyCommissionToRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyCommissionToRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}
