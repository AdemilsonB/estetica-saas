"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useResetCustomerMessageTemplate,
  useUpdateCustomerMessageTemplate,
  type CustomerMessageTemplateItem,
} from "@/hooks/settings/use-customer-message-templates";
import { interpolateTemplate } from "@/domains/notifications/user-notifications/notification-template-engine";

const CORPO_MAX = 1500;

// Cobre todas as variáveis do catálogo (`customer-message-catalog.ts`), para que a prévia
// nunca mostre um `{{...}}` sem substituir, seja qual for o evento aberto.
const PREVIEW_DATA: Record<string, string> = {
  cliente: "Maria Silva",
  primeiro_nome: "Maria",
  servico: "Escova",
  profissional: "Ana",
  data: "02/08/2026",
  hora: "14:00",
  dia_semana: "domingo",
  duracao: "45 min",
  valor: "R$ 80,00",
  negocio: "Salão da Lu",
  endereco: "Rua X, 123",
  telefone_negocio: "(11) 99999-0000",
  link_agendamento: "agende.app/agendar/salao-da-lu",
  link_portal: "agende.app/salao-da-lu/cliente",
  dias_sem_vir: "92",
  ultimo_servico: "Escova",
};

const CHANNEL_LABEL: Record<CustomerMessageTemplateItem["channel"], string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
};

export function CustomerMessageEditor({
  open,
  item,
  onOpenChange,
}: {
  open: boolean;
  item: CustomerMessageTemplateItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateCustomerMessageTemplate();
  const reset = useResetCustomerMessageTemplate();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (item) {
      setSubject(item.subject ?? "");
      setBody(item.body);
    }
  }, [item]);

  if (!item) return null;

  function insertVariable(name: string) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${body.slice(0, start)}{{${name}}}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + name.length + 4, start + name.length + 4);
    });
  }

  function handleSave() {
    if (!item) return;
    update.mutate(
      {
        event: item.event,
        channel: item.channel,
        subject: item.channel === "EMAIL" ? subject : null,
        body,
        mediaUrl: item.mediaUrl,
      },
      {
        onSuccess: () => {
          toast.success("Mensagem salva");
          onOpenChange(false);
        },
        onError: () => toast.error("Erro ao salvar a mensagem"),
      },
    );
  }

  function handleConfirmReset() {
    if (!item) return;
    reset.mutate(
      { event: item.event, channel: item.channel },
      {
        onSuccess: () => {
          // Reflete o padrão na hora — não depende do refetch da lista para o usuário ver o texto voltar.
          setSubject(item.defaultSubject ?? "");
          setBody(item.defaultBody);
          setConfirmResetOpen(false);
          toast.success("Mensagem restaurada ao padrão");
          // Fecha o editor: `item.isCustom` (prop vinda da lista) só atualiza depois do refetch
          // disparado pela invalidação do hook. Manter o modal aberto faria o selo "Personalizada"
          // e o botão "Restaurar padrão" continuarem visíveis por engano — a tela mentiria sobre o
          // que já aconteceu. Fechar força reabrir com o estado (já correto) vindo da lista.
          onOpenChange(false);
        },
        onError: () => toast.error("Erro ao restaurar o padrão"),
      },
    );
  }

  const preview = interpolateTemplate(body, PREVIEW_DATA, false);
  const isEmail = item.channel === "EMAIL";
  const overLimit = body.length > CORPO_MAX;
  const subjectMissing = isEmail && subject.trim().length === 0;
  const saveDisabled = update.isPending || body.trim().length === 0 || overLimit || subjectMissing;

  const previewBlock = (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Prévia</p>
      {/* As cores do balão são fixas por tema (e não tokens do design system) para imitar
          o balão do WhatsApp — verde claro no tema claro, verde escuro no escuro. O texto
          NÃO pode usar `text-foreground`: ele inverte no tema escuro e ficaria claro sobre
          o verde claro, ilegível. */}
      <div className="rounded-2xl bg-[#e7fce3] p-3 dark:bg-[#005c4b]">
        {isEmail && subject.trim() !== "" && (
          <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {interpolateTemplate(subject, PREVIEW_DATA, false)}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-50">
          {preview || "—"}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6">
              Editar mensagem — {item.label} ({CHANNEL_LABEL[item.channel]})
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                {isEmail && (
                  <div className="space-y-1.5">
                    <Label htmlFor="msg-subject">Assunto do e-mail</Label>
                    <Input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="msg-body">Mensagem</Label>
                  <Textarea
                    id="msg-body"
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={7}
                    className="resize-none"
                  />
                  <p className={`text-right text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
                    {body.length}/{CORPO_MAX}
                  </p>
                </div>

                {/* Prévia visível logo abaixo do textarea no mobile; some no desktop, onde ocupa a coluna à direita. */}
                <div className="md:hidden">{previewBlock}</div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Toque para inserir uma variável</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.variables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="min-h-11 shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-muted/70"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {item.isCustom && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setConfirmResetOpen(true)}
                  >
                    Restaurar padrão
                  </Button>
                )}
              </div>

              <div className="hidden md:block">{previewBlock}</div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={saveDisabled} className="min-h-11 w-full sm:w-auto">
              {update.isPending ? "Salvando..." : "Salvar mensagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        Confirmação de restaurar padrão: usamos `Dialog` (não `AlertDialog`) de propósito.
        O `AlertDialogPrimitive.Root` do Radix omite a prop `modal` (é sempre modal, por design de
        a11y) — dois modais Radix abertos ao mesmo tempo prendem o `aria-hidden` na raiz do app e
        travam a tela (já visto neste projeto). `Dialog` aceita `modal={false}` no nível interno,
        que é o padrão já usado em outros modais aninhados do projeto (ex.: `picker-detail-modal.tsx`).
      */}
      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen} modal={false}>
        <DialogContent role="alertdialog" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restaurar mensagem padrão?</DialogTitle>
            <DialogDescription>
              O texto personalizado será substituído pelo modelo padrão do sistema. Essa ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmResetOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmReset} disabled={reset.isPending}>
              {reset.isPending ? "Restaurando..." : "Restaurar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
