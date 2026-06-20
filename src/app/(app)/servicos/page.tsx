import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServiceCatalog } from '@/components/domain/services/service-catalog'
import { PackageCatalog } from '@/components/domain/services/package-catalog'
import { PromotionCatalog } from '@/components/domain/services/promotion-catalog'
import { CategoryCatalog } from '@/components/domain/services/category-catalog'
import { DiscountTypesManager } from '@/components/domain/settings/discount-types-manager'
import { CommissionsGrid } from '@/components/domain/settings/commissions-grid'

export const metadata = { title: 'Serviços · Estética SaaS' }

export default function ServicosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Serviços</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie seus serviços, pacotes, promoções e precificação
        </p>
      </div>

      <div className="space-y-6">
        {/* Grupo 1: Catálogo */}
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

        {/* Grupo 2: Precificação */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Precificação</p>
          <Tabs defaultValue="descontos">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="descontos">Descontos</TabsTrigger>
              <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            </TabsList>

            <TabsContent value="descontos" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Tipos de desconto</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Configure os tipos de desconto aplicáveis em atendimentos.
                </p>
                <DiscountTypesManager />
              </div>
            </TabsContent>

            <TabsContent value="comissoes" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Comissões</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Defina as comissões por profissional e serviço.
                </p>
                <CommissionsGrid />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
