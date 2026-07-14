"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useNotificationTemplate,
  useUpdateNotificationTemplate,
} from "@/hooks/settings/use-team-notification-settings";
import { TEAM_NOTIFICATION_CATALOG_MAP } from "@/domains/notifications/user-notifications/team-notification-catalog";
import { interpolateTemplate } from "@/domains/notifications/user-notifications/notification-template-engine";

const PREVIEW_DATA: Record<string, string> = {
  cliente: "Maria Silva",
  servico: "Corte",
  profissional: "Ana",
  data: "20/07",
  hora: "14:00",
  negocio: "Seu Salão",
  valor: "3",
  link_acao: "https://app.agend.me/agenda",
};

export function TeamNotificationTemplateEditor({
  open,
  eventType,
  channel,
  onOpenChange,
}: {
  open: boolean;
  eventType: NotificationEventType | null;
  channel: TeamNotificationChannel;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: template, isLoading } = useNotificationTemplate(eventType ?? "appointment_created", channel, open && eventType !== null);
  const update = useUpdateNotificationTemplate();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setSubject(template.subject ?? "");
      setBody(template.body);
    }
  }, [template]);

  if (!eventType) return null;
  const catalogEntry = TEAM_NOTIFICATION_CATALOG_MAP[eventType];

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
    const confirmedEventType: NotificationEventType = eventType ?? "appointment_created";
    update.mutate(
      { eventType: confirmedEventType, channel, subject: channel === "EMAIL" ? subject : null, body },
      { onSuccess: () => { toast.success("Mensagem salva"); onOpenChange(false); }, onError: () => toast.error("Erro ao salvar") },
    );
  }

  const preview = interpolateTemplate(body, PREVIEW_DATA, false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar mensagem — {catalogEntry?.label}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : (
          <div className="space-y-4">
            {channel === "EMAIL" && (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Assunto do e-mail</Label>
                <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Mensagem</Label>
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {catalogEntry?.variables.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="min-h-8 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Prévia</p>
              <p className="text-sm text-foreground">{preview}</p>
            </div>

            <Button onClick={handleSave} disabled={update.isPending || body.length === 0} className="w-full">
              {update.isPending ? "Salvando..." : "Salvar mensagem"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
