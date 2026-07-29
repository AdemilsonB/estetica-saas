"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PercentageInput } from "@/components/ui/percentage-input";
import { Label } from "@/components/ui/label";
import { useCardFees, useSaveCardFees } from "@/hooks/settings/use-commissions";

export function CardFeesForm() {
  const { data, isLoading } = useCardFees();
  const save = useSaveCardFees();
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");

  useEffect(() => {
    if (data) {
      setDebit(data.DEBIT_CARD != null ? String(data.DEBIT_CARD) : "");
      setCredit(data.CREDIT_CARD != null ? String(data.CREDIT_CARD) : "");
    }
  }, [data]);

  function handleSave() {
    save.mutate(
      { DEBIT_CARD: parseFloat(debit) || 0, CREDIT_CARD: parseFloat(credit) || 0 },
      { onSuccess: () => toast.success("Taxas salvas"), onError: () => toast.error("Erro") },
    );
  }

  if (isLoading) return <div className="h-20 animate-pulse rounded-xl bg-slate-100" />;

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-700">Taxas de cartão</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Cartão de débito (%)</Label>
          <PercentageInput max={20} value={debit} onChange={setDebit} />
        </div>
        <div className="space-y-1.5">
          <Label>Cartão de crédito (%)</Label>
          <PercentageInput max={20} value={credit} onChange={setCredit} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={save.isPending} size="sm">
        {save.isPending ? "Salvando..." : "Salvar taxas"}
      </Button>
    </div>
  );
}
