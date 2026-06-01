"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCardFees, useSaveCardFees } from "@/hooks/settings/use-commissions";

export function CardFeesForm() {
  const { data, isLoading } = useCardFees();
  const save = useSaveCardFees();
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");

  useEffect(() => {
    if (data) {
      setDebit(String(data.DEBIT_CARD ?? 0));
      setCredit(String(data.CREDIT_CARD ?? 0));
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
          <Input type="number" min={0} max={20} step={0.1} value={debit}
            onChange={(e) => setDebit(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cartão de crédito (%)</Label>
          <Input type="number" min={0} max={20} step={0.1} value={credit}
            onChange={(e) => setCredit(e.target.value)} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={save.isPending} size="sm">
        {save.isPending ? "Salvando..." : "Salvar taxas"}
      </Button>
    </div>
  );
}
