type PublicProduct = {
  id: string
  name: string
  salePrice: number
  imageUrl?: string | null
  categoryName?: string | null
}

type Props = {
  products: PublicProduct[]
  primaryColor: string
}

export function VitrineProductsSection({ products, primaryColor }: Props) {
  if (products.length === 0) return null

  return (
    <section id="produtos" className="mx-auto max-w-3xl px-4 pt-8">
      <h2 className="mb-5 text-lg font-bold">Produtos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card overflow-hidden">
            <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl">🧴</span>
              )}
            </div>
            <div className="p-3">
              {p.categoryName && (
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {p.categoryName}
                </p>
              )}
              <p className="text-sm font-medium leading-tight">{p.name}</p>
              <p className="mt-0.5 text-sm font-semibold" style={{ color: primaryColor }}>
                R$ {p.salePrice.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
