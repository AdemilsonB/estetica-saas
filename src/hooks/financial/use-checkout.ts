import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CheckoutInput = {
  paymentMethod: string;
  discountTypeId?: string;
  discountValue?: number;
  tipAmount?: number;
  baseAmount?: number;
};

async function postCheckout(appointmentId: string, input: CheckoutInput) {
  const res = await fetch(`/api/scheduling/appointments/${appointmentId}/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao processar checkout");
  return res.json();
}

async function postCourtesy(appointmentId: string) {
  const res = await fetch(`/api/scheduling/appointments/${appointmentId}/courtesy`, { method: "POST" });
  if (!res.ok) throw new Error("Erro ao marcar cortesia");
}

async function postDebt(appointmentId: string) {
  const res = await fetch(`/api/scheduling/appointments/${appointmentId}/debt`, { method: "POST" });
  if (!res.ok) throw new Error("Erro ao marcar inadimplente");
}

async function fetchPendingPayments() {
  const res = await fetch("/api/financial/pending-payments");
  if (!res.ok) throw new Error("Erro ao buscar cobranças pendentes");
  return res.json();
}

async function fetchSummary(from: string, to: string) {
  const res = await fetch(`/api/financial/summary?from=${from}&to=${to}`);
  if (!res.ok) throw new Error("Erro ao buscar resumo financeiro");
  return res.json();
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, input }: { appointmentId: string; input: CheckoutInput }) =>
      postCheckout(appointmentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
    },
  });
}

export function useMarkCourtesy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) => postCourtesy(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useMarkDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) => postDebt(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
    },
  });
}

export function usePendingPayments() {
  return useQuery({ queryKey: ["pending-payments"], queryFn: fetchPendingPayments });
}

export function useFinancialSummary(from: string, to: string) {
  return useQuery({
    queryKey: ["financial-summary", from, to],
    queryFn: () => fetchSummary(from, to),
    enabled: !!from && !!to,
  });
}
