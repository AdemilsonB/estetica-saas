'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CatalogGrid } from '@/components/domain/catalog/CatalogGrid'

export default function CatalogSettingsPage() {
  const [segments, setSegments] = useState<string[]>([])
  const [isLoadingSegments, setIsLoadingSegments] = useState(true)

  useEffect(() => {
    fetch('/api/onboarding/segments')
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar segmentos')
        return res.json()
      })
      .then((data: { segments?: string[] }) => setSegments(data.segments ?? []))
      .catch(() => {})
      .finally(() => setIsLoadingSegments(false))
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <p className="text-muted-foreground">
          Ative itens do catálogo para criar sua lista de serviços e produtos.
        </p>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          {isLoadingSegments ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <CatalogGrid
              type="services"
              segments={segments}
              serviceEditBasePath="/configuracoes/servicos"
            />
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          {isLoadingSegments ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <CatalogGrid
              type="products"
              segments={segments}
              productEditBasePath="/configuracoes/produtos"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
