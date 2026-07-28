"use client";

import { useMemo, useState } from "react";
import { CustomerMessageSettingsMatrix } from "@/components/domain/settings/customer-message-settings-matrix";
import { CustomerMessageEditor } from "@/components/domain/settings/customer-message-editor";
import {
  useCustomerMessageTemplates,
  type CustomerMessageTemplateItem,
} from "@/hooks/settings/use-customer-message-templates";

export function CustomerMessageList() {
  const { data: templates } = useCustomerMessageTemplates();
  const [editando, setEditando] = useState<{ event: string; channel: "WHATSAPP" | "EMAIL" } | null>(
    null,
  );

  const item = useMemo<CustomerMessageTemplateItem | null>(() => {
    if (!editando || !templates) return null;
    return (
      templates.find((t) => t.event === editando.event && t.channel === editando.channel) ?? null
    );
  }, [editando, templates]);

  return (
    <div className="space-y-4">
      <CustomerMessageSettingsMatrix
        onEditTemplate={(event, channel) => setEditando({ event, channel })}
      />

      <CustomerMessageEditor
        open={item !== null}
        item={item}
        onOpenChange={(open) => {
          if (!open) setEditando(null);
        }}
      />
    </div>
  );
}
