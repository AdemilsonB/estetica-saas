"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckout, useMarkCourtesy } from "@/hooks/financial/use-checkout";
import { useDiscountTypes } from "@/hooks/settings/use-discount-types";
import type { Appointment } from "@/hooks/scheduling/use-appointments";

const PAYMENT_METHODS = [
  { value: "CASH",        label: "Dinheiro" },
  { value: "PIX",         label: "PIX" },
  { value: "DEBIT_CARD",  label: "Cartão de débito" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
  { value: "TRANSFER",    label: "Transferência" },
];

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Props = {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
  onAfterCheckout?: () => void;
};

export function RegisterPaymentModal({ appointment, open, onClose, onAfterCheckout }: Props) {
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [discountTypeId, setDiscountTypeId] = useState<string | undefined>();
  const [discountApplyType, setDiscountApplyType] = useState<"PERCENTAGE" | "FIXED_VALUE">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [discountOpen, setDiscountOpen] = useState(false);

  const checkout = useCheckout();
  const markCourtesy = useMarkCourtesy();
  const { data: discountTypes = [] } = useDiscountTypes(true);

  const originalAmount = appointment
    ? appointment.confirmedPrice
      ? Number(appointment.confirmedPrice)
      : Number(appointment.price)
    : 0;

  useEffect(() => {
    if (open && appointment) {
      setBaseAmount(originalAmount);
      setPaymentMethod("");
      setDiscountTypeId(undefined);
      setDiscountValue(0);
      setTipAmount(0);
    }
  }, [open, appointment]);

  const computedDiscount = discountApplyType === "PERCENTAGE"
    ? baseAmount * discountValue / 100
    : discountValue;
  const subtotal = baseAmount - computedDiscount;
  const net = subtotal + tipAmount;

  const baseChanged = baseAmount !== originalAmount;

  function handleSelectDiscount(id: string) {
    const found = discountTypes.find((d: { id: string; type: string; defaultValue: number | null }) => d.id === id);
    if (found) {
      setDiscountTypeId(id);
      setDiscountApplyType(found.type as "PERCENTAGE" | "FIXED_VALUE");
      setDiscountValue(found.defaultValue ? Number(found.defaultValue) : 0);
    }
    setDiscountOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment || !paymentMethod) return;
    checkout.mutate(
      {
        appointmentId: appointment.id,
        input: {
          paymentMethod,
          discountTypeId,
          discountValue: discountValue || undefined,
          tipAmount,
          ...(baseChanged && { baseAmount }),
        },
      },
      {
        onSuccess: () => {
          toast.success("Pagamento registrado");
          if (onAfterCheckout) {
            onAfterCheckout();
          } else {
            onClose();
          }
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
      },
    );
  }

  function handleCourtesy() {
    if (!appointment) return;
    markCourtesy.mutate(appointment.id, {
      onSuccess: () => {
        toast.success("Marcado como cortesia");
        if (onAfterCheckout) {
          onAfterCheckout();
        } else {
          onClose();
        }
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
    });
  }

  if (!appointment) return null;

  const selectedDiscount = discountTypes.find((d: { id: string }) => d.id === discountTypeId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Concluir atendimento — {appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? 'Serviço'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Resumo cliente */}
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="font-medium text-slate-900">{appointment.customer.name}</p>
            <div className="mt-2 space-y-1">
              {computedDiscount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Desconto</span>
                  <span>-{fmt(computedDiscount)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Gorjeta</span>
                  <span>+{fmt(tipAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
                <span>Total</span>
                <span className="text-emerald-700">{fmt(net)}</span>
              </div>
            </div>
          </div>

          {/* Valor do serviço — editável */}
          <div className="space-y-1.5">
            <Label htmlFor="base-amount">
              Valor do serviço (R$)
              {baseChanged && (
                <span className="ml-2 text-xs font-normal text-amber-600">
                  original: {fmt(originalAmount)}
                </span>
              )}
            </Label>
            <Input
              id="base-amount"
              type="number"
              min={0}
              step={0.01}
              value={baseAmount}
              onChange={(e) => {
                setBaseAmount(Number(e.target.value));
                setDiscountValue(0);
                setDiscountTypeId(undefined);
              }}
            />
          </div>

          {/* Desconto */}
          <div className="space-y-1.5">
            <Label htmlFor="discount-value">Desconto (opcional)</Label>
            <div className="flex gap-2">
              <Popover open={discountOpen} onOpenChange={setDiscountOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="flex-1 justify-between text-left font-normal">
                    {selectedDiscount ? (selectedDiscount as { name: string }).name : "Selecionar tipo..."}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0">
                  <Command>
                    <CommandInput placeholder="Buscar desconto..." />
                    <CommandList>
                      <CommandEmpty>Nenhum desconto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {discountTypes.map((d: { id: string; name: string; type: string; defaultValue: number | null }) => (
                          <CommandItem key={d.id} value={d.name} onSelect={() => handleSelectDiscount(d.id)}>
                            <Check className={cn("mr-2 size-4", discountTypeId === d.id ? "opacity-100" : "opacity-0")} />
                            {d.name} · {d.type === "PERCENTAGE" ? `${d.defaultValue ?? 0}%` : fmt(Number(d.defaultValue ?? 0))}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-1">
                <Input
                  id="discount-value"
                  type="number"
                  min={0}
                  step={0.01}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-slate-500">{discountApplyType === "PERCENTAGE" ? "%" : "R$"}</span>
              </div>
            </div>
          </div>

          {/* Gorjeta */}
          <div className="space-y-1.5">
            <Label htmlFor="tip-amount">Gorjeta (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tip-amount"
                type="number"
                min={0}
                step={0.5}
                value={tipAmount}
                onChange={(e) => setTipAmount(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-slate-500">R$</span>
            </div>
          </div>

          {/* Forma de pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-method">Forma de pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCourtesy}
              disabled={markCourtesy.isPending || checkout.isPending}
            >
              Cortesia
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!paymentMethod || checkout.isPending}
            >
              {checkout.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
