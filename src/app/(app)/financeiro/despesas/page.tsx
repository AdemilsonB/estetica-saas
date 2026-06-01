"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useExpenses, useCreateExpense, useDeleteExpense,
  useRecurringExpenses, useCreateRecurringExpense, useToggleRecurringExpense,
} from "@/hooks/financial/use-expenses";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ExpenseForm({ onSubmit, loading }: {
  onSubmit: (d: { category: string; description: string; amount: string; paidAt: string }) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({ category: "", description: "", amount: "", paidAt: new Date().toISOString().split("T")[0] });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria *</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ex: Aluguel" />
        </div>
        <div className="space-y-1.5">
          <Label>Valor (R$) *</Label>
          <Input type="number" min={0.01} step={0.01} value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição *</Label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição da despesa" />
      </div>
      <div className="space-y-1.5">
        <Label>Data</Label>
        <Input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
      </div>
      <Button className="w-full" disabled={!form.category || !form.description || !form.amount || loading}
        onClick={() => onSubmit(form)}>
        {loading ? "Salvando..." : "Lançar despesa"}
      </Button>
    </div>
  );
}

function RecurringForm({ onSubmit, loading }: {
  onSubmit: (d: { category: string; description: string; amount: string; recurrenceType: string; nextDueDate: string }) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    category: "", description: "", amount: "",
    recurrenceType: "MONTHLY",
    nextDueDate: new Date().toISOString().split("T")[0],
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria *</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ex: Aluguel" />
        </div>
        <div className="space-y-1.5">
          <Label>Valor (R$) *</Label>
          <Input type="number" min={0.01} step={0.01} value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição *</Label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Recorrência</Label>
          <Select value={form.recurrenceType} onValueChange={(v) => setForm({ ...form, recurrenceType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Mensal</SelectItem>
              <SelectItem value="WEEKLY">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Próximo vencimento</Label>
          <Input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
        </div>
      </div>
      <Button className="w-full" disabled={!form.category || !form.description || !form.amount || loading}
        onClick={() => onSubmit(form)}>
        {loading ? "Salvando..." : "Criar despesa fixa"}
      </Button>
    </div>
  );
}

export default function DespesasPage() {
  const { data: expenses } = useExpenses();
  const { data: recurring = [] } = useRecurringExpenses();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const createRecurring = useCreateRecurringExpense();
  const toggleRecurring = useToggleRecurringExpense();
  const [varOpen, setVarOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);

  function handleCreateExpense(d: { category: string; description: string; amount: string; paidAt: string }) {
    createExpense.mutate(
      { category: d.category, description: d.description, amount: parseFloat(d.amount), paidAt: new Date(d.paidAt).toISOString() },
      { onSuccess: () => { toast.success("Despesa lançada"); setVarOpen(false); }, onError: () => toast.error("Erro") },
    );
  }

  function handleCreateRecurring(d: { category: string; description: string; amount: string; recurrenceType: string; nextDueDate: string }) {
    createRecurring.mutate(
      { category: d.category, description: d.description, amount: parseFloat(d.amount), recurrenceType: d.recurrenceType, nextDueDate: new Date(d.nextDueDate).toISOString() },
      { onSuccess: () => { toast.success("Despesa fixa criada"); setFixOpen(false); }, onError: () => toast.error("Erro") },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Despesas</h1>

      <Tabs defaultValue="variaveis">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
          <TabsTrigger value="fixas">Fixas / Recorrentes</TabsTrigger>
        </TabsList>

        <TabsContent value="variaveis" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={varOpen} onOpenChange={setVarOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="size-3.5" /> Lançar despesa</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
                <ExpenseForm onSubmit={handleCreateExpense} loading={createExpense.isPending} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl border border-white/80 bg-white/85 shadow-sm">
            {!expenses?.data?.length ? (
              <p className="py-8 text-center text-sm text-slate-400">Nenhuma despesa lançada.</p>
            ) : expenses.data.map((e: { id: string; category: string; description: string; amount: number; paidAt: string | null }) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{e.description}</p>
                  <p className="text-xs text-slate-400">{e.category} · {e.paidAt ? new Date(e.paidAt).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-red-600">-{fmt(Number(e.amount))}</span>
                  <Button size="icon" variant="ghost" className="size-7 text-slate-400 hover:text-red-500"
                    onClick={() => deleteExpense.mutate(e.id, { onSuccess: () => toast.success("Removida"), onError: () => toast.error("Erro") })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="fixas" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={fixOpen} onOpenChange={setFixOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="size-3.5" /> Nova despesa fixa</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Nova despesa fixa</DialogTitle></DialogHeader>
                <RecurringForm onSubmit={handleCreateRecurring} loading={createRecurring.isPending} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl border border-white/80 bg-white/85 shadow-sm">
            {!recurring.length ? (
              <p className="py-8 text-center text-sm text-slate-400">Nenhuma despesa fixa cadastrada.</p>
            ) : recurring.map((r: { id: string; category: string; description: string; amount: number; recurrenceType: string; nextDueDate: string; active: boolean }) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.description}</p>
                  <p className="text-xs text-slate-400">
                    {r.category} · {r.recurrenceType === "MONTHLY" ? "Mensal" : "Semanal"} · próx. {new Date(r.nextDueDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-red-600">-{fmt(Number(r.amount))}</span>
                  <Badge className={r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}>
                    {r.active ? "Ativo" : "Pausado"}
                  </Badge>
                  <Button size="icon" variant="ghost" className="size-7"
                    onClick={() => toggleRecurring.mutate({ id: r.id, active: !r.active }, { onSuccess: () => toast.success(r.active ? "Pausada" : "Reativada"), onError: () => toast.error("Erro") })}>
                    {r.active ? <ToggleRight className="size-4 text-emerald-600" /> : <ToggleLeft className="size-4 text-slate-400" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
