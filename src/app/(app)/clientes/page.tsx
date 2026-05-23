// src/app/(app)/clientes/page.tsx
import { CustomerList } from '@/components/domain/crm/customer-list'

export const metadata = { title: 'Clientes · Estética SaaS' }

export default function ClientesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie sua base de clientes
        </p>
      </div>
      <CustomerList />
    </div>
  )
}
