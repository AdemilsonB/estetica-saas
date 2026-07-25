import { after } from "next/server";

import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerInventorySubscriptions } from "@/domains/inventory/subscriptions";
import { registerUserNotificationSubscriptions } from "@/domains/notifications/user-notifications/user-notifications.subscriptions";
import { eventBus } from "@/shared/events/event-bus";

let initialized = false;

export function initializeDomainRuntime() {
  if (!initialized) {
    try {
      registerFinancialSubscriptions();
      registerNotificationSubscriptions();
      registerInventorySubscriptions();
      registerUserNotificationSubscriptions();
    } catch (err) {
      console.error("[runtime] Falha ao registrar subscriptions:", err);
    }

    initialized = true;
  }

  // A cada request: garante que os efeitos colaterais dos eventos (envio de
  // WhatsApp/e-mail, gravação de log, movimentação de estoque etc.) terminem
  // ANTES de a função serverless ser congelada. Sem isso, os handlers async do
  // event bus ficam pendentes e o Vercel encerra a função após a resposta —
  // a mensagem nunca sai e nada é logado. `after()` mantém a função viva até o
  // flush concluir, sem bloquear a resposta ao usuário.
  try {
    after(() => eventBus.flush());
  } catch {
    // Fora de um escopo de request (scripts, testes, build): não há função para
    // congelar, então o trabalho async do event bus conclui naturalmente.
  }
}
