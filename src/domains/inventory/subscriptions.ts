let inventorySubscriptionsRegistered = false

export function registerInventorySubscriptions() {
  if (inventorySubscriptionsRegistered) return
  inventorySubscriptionsRegistered = true
  // Sem eventos externos para ouvir nesta fase do inventory
}
