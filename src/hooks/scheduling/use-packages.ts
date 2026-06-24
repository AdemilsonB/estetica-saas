import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type PackageService = {
  id: string
  name: string
  duration: number
  price: string
}

export type PackageItem = {
  id: string
  serviceId: string
  service: PackageService
}

export type ServicePackage = {
  id: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
  imageCropX: number | null
  imageCropY: number | null
  imageCropZoom: number | null
  active: boolean
  items: PackageItem[]
}

export type CreatePackageInput = {
  name: string
  description?: string
  price: string
  serviceIds: string[]
  imageUrl?: string
}

export type UpdatePackageInput = {
  name?: string
  description?: string
  price?: string
  serviceIds?: string[]
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
}

async function listPackages(): Promise<ServicePackage[]> {
  const res = await fetch('/api/scheduling/packages')
  if (!res.ok) throw new Error('Falha ao carregar pacotes')
  return res.json()
}

async function createPackage(input: CreatePackageInput): Promise<ServicePackage> {
  const res = await fetch('/api/scheduling/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, price: parseFloat(input.price) }),
  })
  if (!res.ok) throw new Error('Falha ao criar pacote')
  return res.json()
}

async function updatePackage({ id, ...input }: UpdatePackageInput & { id: string }): Promise<ServicePackage> {
  const res = await fetch(`/api/scheduling/packages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      price: input.price !== undefined ? parseFloat(input.price) : undefined,
    }),
  })
  if (!res.ok) throw new Error('Falha ao atualizar pacote')
  return res.json()
}

async function deactivatePackage(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/packages/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desativar pacote')
}

export function usePackages() {
  return useQuery({ queryKey: ['packages'], queryFn: listPackages, staleTime: 5 * 60 * 1000 })
}

export function useCreatePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPackage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  })
}

export function useUpdatePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePackage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  })
}

export function useDeactivatePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivatePackage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  })
}
