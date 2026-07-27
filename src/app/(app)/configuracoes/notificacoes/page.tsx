"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { TeamNotificationBusinessSettings } from "@/components/domain/settings/team-notification-business-settings";
import { TeamNotificationTemplateEditor } from "@/components/domain/settings/team-notification-template-editor";
import { TeamNotificationMyPreferences } from "@/components/domain/settings/team-notification-my-preferences";
import { CustomerMessageList } from "@/components/domain/settings/customer-message-list";

type EditingTemplate = { eventType: NotificationEventType; channel: TeamNotificationChannel };

function EquipeTabContent({
  canManageBusiness,
  onEditTemplate,
}: {
  canManageBusiness: boolean;
  onEditTemplate: (eventType: NotificationEventType, channel: TeamNotificationChannel) => void;
}) {
  return (
    <div className="space-y-6">
      {canManageBusiness && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Avisos do negócio</h2>
            <TeamNotificationBusinessSettings onEditTemplate={onEditTemplate} />
          </section>
          <div className="border-t border-border" />
        </>
      )}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Minhas preferências</h2>
        <TeamNotificationMyPreferences />
      </section>
    </div>
  );
}

function NotificacoesContent() {
  const { can, isLoading } = usePermissions();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<EditingTemplate | null>(null);

  const canManageBusiness = can("configuracoes", "edit");

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    );
  }

  const initialTab = canManageBusiness && searchParams.get("tab") === "cliente" ? "cliente" : "equipe";

  function openEditor(eventType: NotificationEventType, channel: TeamNotificationChannel) {
    setEditing({ eventType, channel });
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

      {canManageBusiness ? (
        <Tabs defaultValue={initialTab}>
          <TabsList className="grid h-auto! w-full grid-cols-2 gap-1">
            <TabsTrigger value="equipe" className="min-h-11 h-auto whitespace-normal text-center leading-tight px-2 py-2">
              Notificações da equipe
            </TabsTrigger>
            <TabsTrigger value="cliente" className="min-h-11 h-auto whitespace-normal text-center leading-tight px-2 py-2">
              Mensagens ao cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipe" className="mt-4">
            <EquipeTabContent canManageBusiness onEditTemplate={openEditor} />
          </TabsContent>

          <TabsContent value="cliente" className="mt-4">
            <CustomerMessageList />
          </TabsContent>
        </Tabs>
      ) : (
        <EquipeTabContent canManageBusiness={false} onEditTemplate={openEditor} />
      )}

      <TeamNotificationTemplateEditor
        open={editing !== null}
        eventType={editing?.eventType ?? null}
        channel={editing?.channel ?? "IN_APP"}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
      />
    </div>
  );
}

export default function NotificacoesConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
        </div>
      }
    >
      <NotificacoesContent />
    </Suspense>
  );
}
