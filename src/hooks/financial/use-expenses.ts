import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchExpenses(params: string) {
  const res = await fetch(`/api/financial/expenses?${params}`);
  if (!res.ok) throw new Error("Erro ao buscar despesas");
  return res.json();
}

async function createExpense(input: { category: string; description: string; amount: number; paidAt?: string }) {
  const res = await fetch("/api/financial/expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao criar despesa");
  return res.json();
}

async function deleteExpense(id: string) {
  const res = await fetch(`/api/financial/expenses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir despesa");
}

async function fetchRecurring() {
  const res = await fetch("/api/financial/recurring-expenses");
  if (!res.ok) throw new Error("Erro ao buscar despesas fixas");
  return res.json();
}

async function createRecurring(input: { category: string; description: string; amount: number; recurrenceType: string; nextDueDate: string }) {
  const res = await fetch("/api/financial/recurring-expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao criar despesa fixa");
  return res.json();
}

async function toggleRecurring(id: string, active: boolean) {
  const res = await fetch(`/api/financial/recurring-expenses/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ active }),
  });
  if (!res.ok) throw new Error("Erro ao atualizar despesa fixa");
}

export function useExpenses(page = 1) {
  return useQuery({
    queryKey: ["expenses", page],
    queryFn: () => fetchExpenses(`page=${page}&limit=20`),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useRecurringExpenses() {
  return useQuery({ queryKey: ["recurring-expenses"], queryFn: fetchRecurring });
}

export function useCreateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRecurring,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-expenses"] }),
  });
}

export function useToggleRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleRecurring(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-expenses"] }),
  });
}
