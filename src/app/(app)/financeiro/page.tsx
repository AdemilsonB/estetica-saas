"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinancialDaySummary } from "@/components/domain/financial/day-summary";
import { TransactionList } from "@/components/domain/financial/transaction-list";
import { usePermissions } from "@/hooks/use-permissions";
import { usePendingPayments, useFinancialSummary } from "@/hooks/financial/use-checkout";
import { FINANCIAL_CATEGORIES } from "@/domains/financial/categories";
import type { TransactionType } from "@/hooks/financial/use-transactions";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type SummaryData = {
  grossRevenue: number;
  discounts: number;
  tips: number;
  cardFees: number;
  netRevenue: number;
  supplyExpenses: number;
  supplyReversals: number;
  netSupplyCost: number;
  stockPurchases: number;
  courtesies: number;
  operationalExpenses: number;
  totalExpenses: number;
  profit: number;
};

const CATEGORIES = [
  FINANCIAL_CATEGORIES.SERVICE,
  FINANCIAL_CATEGORIES.PRODUCT_SALE,
  FINANCIAL_CATEGORIES.STOCK_PURCHASE,
  FINANCIAL_CATEGORIES.SUPPLY_USE,
  FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,
  FINANCIAL_CATEGORIES.COURTESY,
  FINANCIAL_CATEGORIES.FIXED_EXPENSE,
  FINANCIAL_CATEGORIES.VARIABLE,
];

export default function FinanceiroPage() {
  const { can } = usePermissions();
  const { data: pending = [] } = usePendingPayments();
  const [txType, setTxType] = useState<"all" | TransactionType>("all");
  const [txCategory, setTxCategory] = useState("all");

  const today = new Date();
  const from = startOfMonth(today).toISOString();
  const to = endOfDay(today).toISOString();
  const { data: summary } = useFinancialSummary(from, to) as { data: SummaryData | undefined };

  if (!can("financeiro", "view")) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Você não tem permissão para acessar o financeiro.
          </p>
        </div>
      </div>
    );
  }

  const dayFrom = new Date();
  dayFrom.setHours(0, 0, 0, 0);
  const dayTo = endOfDay(today);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500">Resumo do mês atual</p>
      </div>

      {(pending as unknown[]).length > 0 && (
        <Link href="/financeiro/cobrancas">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 hover:bg-amber-100 transition-colors">
            <AlertCircle className="size-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {(pending as unknown[]).length} cobrança
                {(pending as unknown[]).length !== 1 ? "s" : ""} pendente
                {(pending as unknown[]).length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600">Clique para ver e registrar pagamentos</p>
            </div>
            <ArrowRight className="size-4 text-amber-600" />
          </div>
        </Link>
      )}

      {summary && (
        <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-700">Resultado do mês</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Receita bruta</span>
              <span>{fmt(summary.grossRevenue)}</span>
            </div>
            {summary.discounts > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Descontos</span>
                <span>-{fmt(summary.discounts)}</span>
              </div>
            )}
            {summary.tips > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Gorjetas</span>
                <span>+{fmt(summary.tips)}</span>
              </div>
            )}
            {summary.cardFees > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Taxas de cartão</span>
                <span>-{fmt(summary.cardFees)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t border-slate-100 pt-1.5">
              <span>Receita líquida</span>
              <span>{fmt(summary.netRevenue)}</span>
            </div>

            {summary.supplyExpenses > 0 && (
              <div className="space-y-0.5 pl-2 border-l-2 border-slate-100 mt-1">
                <div className="flex justify-between text-slate-500">
                  <span>Insumos de serviço</span>
                  <span>-{fmt(summary.supplyExpenses)}</span>
                </div>
                {summary.supplyReversals > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span className="pl-2 text-xs">↩ Estornos de insumo</span>
                    <span>+{fmt(summary.supplyReversals)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 text-xs">
                  <span className="pl-2">Custo líquido</span>
                  <span>-{fmt(summary.netSupplyCost)}</span>
                </div>
              </div>
            )}
            {summary.stockPurchases > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Compras de estoque</span>
                <span>-{fmt(summary.stockPurchases)}</span>
              </div>
            )}
            {summary.operationalExpenses > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Despesas operacionais</span>
                <span>-{fmt(summary.operationalExpenses)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Total despesas</span>
              <span>-{fmt(summary.totalExpenses)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-1.5">
              <span>Lucro real</span>
              <span className={summary.profit >= 0 ? "text-emerald-700" : "text-red-600"}>
                {fmt(summary.profit)}
              </span>
            </div>
          </div>
        </div>
      )}

      <FinancialDaySummary />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Transações de hoje</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/financeiro/despesas" className="flex items-center gap-1 text-slate-500">
                Despesas <ArrowRight className="size-3" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link
                href="/financeiro/transacoes"
                className="flex items-center gap-1 text-slate-500"
              >
                Ver histórico <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Select
            value={txType}
            onValueChange={(v) => setTxType(v as typeof txType)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Tipo: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa / Estorno</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={txCategory}
            onValueChange={(v) => setTxCategory(v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Categoria: Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TransactionList
          from={dayFrom.toISOString()}
          to={dayTo.toISOString()}
          type={txType === "all" ? undefined : txType}
          category={txCategory === "all" ? undefined : txCategory}
          pageSize={10}
        />
      </div>
    </div>
  );
}
