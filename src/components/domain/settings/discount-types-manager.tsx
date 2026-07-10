"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Archive, RotateCcw, Trash2 } from "lucide-react";
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
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useDiscountTypes, useCreateDiscountType, useUpdateDiscountType, useDeleteDiscountType,
} from "@/hooks/settings/use-discount-types";

type DiscountFormData = { name: string; type: string; defaultValue: string };

function DiscountForm({ initial, onSubmit, loading }: {
  initial?: DiscountFormData;
  onSubmit: (data: DiscountFormData) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<DiscountFormData>(
    initial ?? { name: "", type: "PERCENTAGE", defaultValue: "0" },
  );
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nome *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Recomendação" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
              <SelectItem value="FIXED_VALUE">Valor fixo (R$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Valor padrão</Label>
          <Input type="number" min={0} step={0.5} value={form.defaultValue}
            onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} />
        </div>
      </div>
      <Button
        className="w-full"
        disabled={!form.name || loading}
        onClick={() => onSubmit(form)}
      >
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}

export function DiscountTypesManager({ readOnly = false }: { readOnly?: boolean }) {
  const { data: types = [], isLoading } = useDiscountTypes();
  const create = useCreateDiscountType();
  const update = useUpdateDiscountType();
  const del = useDeleteDiscountType();
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreate(data: DiscountFormData) {
    create.mutate(
      { name: data.name, type: data.type, defaultValue: data.defaultValue ? Number(data.defaultValue) : undefined },
      { onSuccess: () => { toast.success("Tipo criado"); setCreateOpen(false); }, onError: () => toast.error("Erro") },
    );
  }

  function handleArchive(id: string) {
    update.mutate({ id, data: { active: false } }, {
      onSuccess: () => toast.success("Arquivado"),
      onError: () => toast.error("Erro"),
    });
  }

  function handleReactivate(id: string) {
    update.mutate({ id, data: { active: true } }, {
      onSuccess: () => toast.success("Reativado"),
      onError: () => toast.error("Erro"),
    });
  }

  function handleDelete(id: string, name: string) {
    del.mutate(id, {
      onSuccess: () => toast.success(`"${name}" excluído`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir"),
    });
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded-xl bg-slate-100" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Tipos de desconto</p>
        {!readOnly && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="size-3.5" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Novo tipo de desconto</DialogTitle></DialogHeader>
              <DiscountForm onSubmit={handleCreate} loading={create.isPending} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {types.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Nenhum tipo de desconto cadastrado.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-white/80 bg-white/85">
          {types.map((d: { id: string; name: string; type: string; defaultValue: number | null; active: boolean; inUse: boolean }) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{d.name}</p>
                <p className="text-xs text-slate-400">
                  {d.type === "PERCENTAGE" ? `${d.defaultValue ?? 0}% padrão` : `R$ ${d.defaultValue ?? 0} padrão`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={d.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}>
                  {d.active ? "Ativo" : "Arquivado"}
                </Badge>
                {!readOnly && d.active && (
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => handleArchive(d.id)} aria-label="Arquivar">
                    <Archive className="size-3.5" />
                  </Button>
                )}
                {!readOnly && !d.active && (
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => handleReactivate(d.id)} aria-label="Reativar">
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
                {!readOnly && d.inUse && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-slate-300 cursor-not-allowed"
                          disabled
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Já usado em agendamentos. Arquive em vez de excluir.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!readOnly && !d.inUse && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7 text-slate-400 hover:text-red-500" disabled={del.isPending}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir &quot;{d.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(d.id, d.name)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
