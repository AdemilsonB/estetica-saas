"use client";

import { useState } from "react";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { TeamNotificationBusinessSettings } from "@/components/domain/settings/team-notification-business-settings";
import { TeamNotificationTemplateEditor } from "@/components/domain/settings/team-notification-template-editor";
import { TeamNotificationMyPreferences } from "@/components/domain/settings/team-notification-my-preferences";
import { CustomerMessageList } from "@/components/domain/settings/customer-message-list";

export default function NotificacoesConfigPage() {
  const { can, isLoading } = usePermissions();
  const [editing, setEditing] = useState<{ eventType: NotificationEventType; channel: TeamNotificationChannel } | null>(null);

  const canManageBusiness = can("configuracoes", "edit");

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notificações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure os avisos da sua equipe, personalize as mensagens que seus clientes recebem e
          ajuste como você quer ser avisado.
        </p>
      </div>

      <Tabs defaultValue={canManageBusiness ? "negocio" : "pessoal"}>
        <TabsList className={`grid h-auto! w-full ${canManageBusiness ? "grid-cols-3" : "grid-cols-1"}`}>
          {canManageBusiness && (
            <TabsTrigger value="negocio" className="min-h-11">Avisos do negócio</TabsTrigger>
          )}
          {canManageBusiness && (
            <TabsTrigger value="cliente" className="min-h-11">Mensagens ao cliente</TabsTrigger>
          )}
          <TabsTrigger value="pessoal" className="min-h-11">
            Minhas preferências
          </TabsTrigger>
        </TabsList>

        {canManageBusiness && (
          <TabsContent value="negocio" className="mt-4">
            <TeamNotificationBusinessSettings
              onEditTemplate={(eventType, channel) => setEditing({ eventType, channel })}
            />
          </TabsContent>
        )}

        {canManageBusiness && (
          <TabsContent value="cliente" className="mt-4">
            <CustomerMessageList />
          </TabsContent>
        )}

        <TabsContent value="pessoal" className="mt-4">
          <TeamNotificationMyPreferences />
        </TabsContent>
      </Tabs>

      <TeamNotificationTemplateEditor
        open={editing !== null}
        eventType={editing?.eventType ?? null}
        channel={editing?.channel ?? "IN_APP"}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
      />
    </div>
  );
}
