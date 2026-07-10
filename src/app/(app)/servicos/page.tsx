import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServiceCatalog } from '@/components/domain/services/service-catalog'
import { PackageCatalog } from '@/components/domain/services/package-catalog'
import { PromotionCatalog } from '@/components/domain/services/promotion-catalog'
import { CategoryCatalog } from '@/components/domain/services/category-catalog'
import { DiscountTypesEntryButton } from '@/components/domain/services/discount-types-entry-button'

export const metadata = { title: 'Serviços · Estética SaaS' }

export default function ServicosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Serviços</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seus serviços, pacotes e promoções
          </p>
        </div>
        <DiscountTypesEntryButton />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catálogo</p>
        <Tabs defaultValue="servicos">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
            <TabsTrigger value="promocoes">Promoções</TabsTrigger>
          </TabsList>

          <TabsContent value="servicos" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Catálogo de serviços</h2>
              <ServiceCatalog />
            </div>
          </TabsContent>

          <TabsContent value="pacotes" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Pacotes</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Agrupe serviços em pacotes com preço especial.
              </p>
              <PackageCatalog />
            </div>
          </TabsContent>

          <TabsContent value="promocoes" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Promoções</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Crie descontos temporários para serviços ou pacotes.
              </p>
              <PromotionCatalog />
            </div>
          </TabsContent>

          <TabsContent value="categorias" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Categorias de serviços</h2>
              <CategoryCatalog />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
