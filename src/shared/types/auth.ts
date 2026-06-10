export type SessionContext = {
  tenantId: string
  userId: string
  isOwner: boolean
  permissions: Record<string, string[]>
  isImpersonating?: boolean
}
