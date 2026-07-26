"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomerMessageTemplates, type CustomerMessageTemplateItem } from "@/hooks/settings/use-customer-message-templates";
import { CustomerMessageEditor } from "@/components/domain/settings/customer-message-editor";

type EventGroup = {
  event: string;
  label: string;
  description: string;
  nature: "transactional" | "promotional";
  whatsapp: CustomerMessageTemplateItem | null;
  email: CustomerMessageTemplateItem | null;
};

function groupByEvent(items: CustomerMessageTemplateItem[]): EventGroup[] {
  const porEvento = new Map<string, EventGroup>();
  for (const item of items) {
    const existente = porEvento.get(item.event);
    const grupo: EventGroup = existente ?? {
      event: item.event,
      label: item.label,
      description: item.description,
      nature: item.nature,
      whatsapp: null,
      email: null,
    };
    if (item.channel === "WHATSAPP") grupo.whatsapp = item;
    else grupo.email = item;
    porEvento.set(item.event, grupo);
  }
  return Array.from(porEvento.values());
}

function ChannelEditButton({
  item,
  label,
  onEdit,
}: {
  item: CustomerMessageTemplateItem | null;
  label: string;
  onEdit: (item: CustomerMessageTemplateItem) => void;
}) {
  if (!item) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        onClick={() => onEdit(item)}
      >
        Editar {label}
      </Button>
      {item.isCustom && (
        <Badge variant="secondary" className="shrink-0">
          Personalizada
        </Badge>
      )}
    </div>
  );
}

export function CustomerMessageList() {
  const { data: items, isLoading, isError, refetch, isFetching } = useCustomerMessageTemplates();
  const [editing, setEditing] = useState<CustomerMessageTemplateItem | null>(null);

  const groups = useMemo(() => groupByEvent(items ?? []), [items]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar as mensagens ao cliente.</p>
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Tentando..." : "Tentar de novo"}
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma mensagem configurável no momento.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Desktop: tabela — nunca cartão espremido com rolagem horizontal no mobile. */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Evento</th>
            <th className="py-2 pr-3 font-medium">WhatsApp</th>
            <th className="py-2 pr-3 font-medium">E-mail</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((grupo) => (
            <tr key={grupo.event} className="border-b border-border last:border-0">
              <td className="py-3 pr-3 align-top">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{grupo.label}</p>
                  {grupo.nature === "promotional" && <Badge variant="outline">Promocional</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{grupo.description}</p>
              </td>
              <td className="py-3 pr-3 align-top">
                <ChannelEditButton item={grupo.whatsapp} label="WhatsApp" onEdit={setEditing} />
              </td>
              <td className="py-3 pr-3 align-top">
                <ChannelEditButton item={grupo.email} label="e-mail" onEdit={setEditing} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: cartões empilhados. */}
      <div className="space-y-3 md:hidden">
        {groups.map((grupo) => (
          <div key={grupo.event} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{grupo.label}</p>
                {grupo.nature === "promotional" && <Badge variant="outline">Promocional</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{grupo.description}</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <ChannelEditButton item={grupo.whatsapp} label="WhatsApp" onEdit={setEditing} />
              <ChannelEditButton item={grupo.email} label="e-mail" onEdit={setEditing} />
            </div>
          </div>
        ))}
      </div>

      <CustomerMessageEditor
        open={editing !== null}
        item={editing}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
      />
    </div>
  );
}
