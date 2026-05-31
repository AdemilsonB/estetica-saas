"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWhatsAppTemplates,
  useUpdateWhatsAppTemplate,
} from "@/hooks/settings/use-notification-settings";

type TemplateName =
  | "confirmacao"
  | "confirmado"
  | "lembrete"
  | "cancelamento"
  | "nao_comparecimento"
  | "aniversario";

const TEMPLATE_LABELS: Record<TemplateName, string> = {
  confirmacao:        "Confirmação de agendamento",
  confirmado:         "Agendamento confirmado",
  lembrete:           "Lembrete 24h antes",
  cancelamento:       "Cancelamento",
  nao_comparecimento: "Não comparecimento",
  aniversario:        "Mensagem de aniversário",
};

function buildPreview(
  template: TemplateName,
  principal: string,
  final: string,
): string {
  const c = {
    nome: "João Silva",
    data: "28/05/2026",
    hora: "14:00",
    servico: "Corte",
    salao: "Seu Negócio",
    link: "https://app.com/agendar/seu-negocio",
  };
  switch (template) {
    case "confirmacao":
      return `Olá, ${c.nome}! ${principal} 📅 ${c.data} às ${c.hora} | ${c.servico} | ${c.salao}. ${final} ${c.link}`;
    case "confirmado":
      return `✅ ${c.nome}, ${principal}! 📅 ${c.data} às ${c.hora} | ${c.servico} | ${c.salao}. ${final} ${c.link}`;
    case "lembrete":
      return `Olá, ${c.nome}! 👋 ${principal} Amanhã às ${c.hora} para ${c.servico} no ${c.salao}. ${final}`;
    case "cancelamento":
      return `Olá, ${c.nome}. ${principal} ${c.servico} | ${c.salao}. ${final}`;
    case "nao_comparecimento":
      return `Olá, ${c.nome}! 😕 ${principal} ${c.servico} | ${c.salao}. ${final}`;
    case "aniversario":
      return `🎂 Olá, ${c.nome}! ${principal} ${c.salao}. ${final}`;
  }
}

export function WhatsAppTemplateEditor() {
  const { data: templates, isLoading } = useWhatsAppTemplates();
  const { mutate, isPending } = useUpdateWhatsAppTemplate();

  const [selected, setSelected] = useState<TemplateName>("confirmacao");
  const [principal, setPrincipal] = useState("");
  const [final, setFinal] = useState("");

  useEffect(() => {
    if (templates?.[selected]) {
      setPrincipal(templates[selected].mensagemPrincipal);
      setFinal(templates[selected].mensagemFinal);
    }
  }, [templates, selected]);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;
  }

  function handleSave() {
    mutate({ template: selected, mensagemPrincipal: principal, mensagemFinal: final });
  }

  const preview = buildPreview(selected, principal, final);
  const principalOver = principal.length > 120;
  const finalOver = final.length > 80;

  return (
    <div className="space-y-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Personalizar mensagens</p>

      <div className="space-y-2">
        <Label>Template</Label>
        <Select
          value={selected}
          onValueChange={(v) => setSelected(v as TemplateName)}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TEMPLATE_LABELS) as TemplateName[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TEMPLATE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="principal">Mensagem principal</Label>
          <span className={`text-xs ${principalOver ? "text-red-500" : "text-slate-400"}`}>
            {principal.length}/120
          </span>
        </div>
        <Textarea
          id="principal"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="final">Mensagem de encerramento</Label>
          <span className={`text-xs ${finalOver ? "text-red-500" : "text-slate-400"}`}>
            {final.length}/80
          </span>
        </div>
        <Textarea
          id="final"
          value={final}
          onChange={(e) => setFinal(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-500">Prévia</p>
        <p className="text-sm text-slate-700">{preview}</p>
      </div>

      <Button
        onClick={handleSave}
        disabled={isPending || principalOver || finalOver}
        className="w-full sm:w-auto"
      >
        {isPending ? "Salvando..." : "Salvar personalização"}
      </Button>
    </div>
  );
}
