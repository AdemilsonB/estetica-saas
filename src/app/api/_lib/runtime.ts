import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerInventorySubscriptions } from "@/domains/inventory/subscriptions";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  try {
    registerFinancialSubscriptions();
    registerNotificationSubscriptions();
    registerInventorySubscriptions();
  } catch (err) {
    console.error("[runtime] Falha ao registrar subscriptions:", err);
  }

  initialized = true;
}
