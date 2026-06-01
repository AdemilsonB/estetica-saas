import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchDiscountTypes(onlyActive = false) {
  const res = await fetch(`/api/settings/discount-types${onlyActive ? "?active=true" : ""}`);
  if (!res.ok) throw new Error("Erro ao buscar tipos de desconto");
  return res.json();
}

async function createDiscountType(input: { name: string; type: string; defaultValue?: number }) {
  const res = await fetch("/api/settings/discount-types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao criar tipo de desconto");
  return res.json();
}

async function updateDiscountType(id: string, data: { name?: string; type?: string; defaultValue?: number; active?: boolean }) {
  const res = await fetch(`/api/settings/discount-types/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao atualizar tipo de desconto");
}

export function useDiscountTypes(onlyActive = false) {
  return useQuery({
    queryKey: ["discount-types", onlyActive],
    queryFn: () => fetchDiscountTypes(onlyActive),
  });
}

export function useCreateDiscountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDiscountType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discount-types"] }),
  });
}

export function useUpdateDiscountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateDiscountType>[1] }) =>
      updateDiscountType(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discount-types"] }),
  });
}
