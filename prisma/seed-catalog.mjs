// prisma/seed-catalog.mjs
export async function seedCatalog(prisma) {
  // Categorias de serviço
  const serviceCategories = [
    { slug: 'corte', name: 'Corte', segments: ['HAIR_SALON', 'BARBERSHOP'] },
    { slug: 'coloracao', name: 'Coloração', segments: ['HAIR_SALON'] },
    { slug: 'tratamento', name: 'Tratamento', segments: ['HAIR_SALON'] },
    { slug: 'barba', name: 'Barba', segments: ['BARBERSHOP'] },
    { slug: 'unhas', name: 'Unhas', segments: ['NAIL_DESIGN'] },
    { slug: 'estetica-facial', name: 'Estética Facial', segments: ['AESTHETICS'] },
    { slug: 'estetica-corporal', name: 'Estética Corporal', segments: ['AESTHETICS'] },
  ]

  for (const cat of serviceCategories) {
    await prisma.catalogServiceCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, segments: cat.segments },
      create: cat,
    })
  }

  // Categorias de produto
  const productCategories = [
    { slug: 'produtos-cabelo', name: 'Cabelo', segments: ['HAIR_SALON'] },
    { slug: 'produtos-barba', name: 'Barba', segments: ['BARBERSHOP'] },
    { slug: 'produtos-unhas', name: 'Unhas', segments: ['NAIL_DESIGN'] },
    { slug: 'produtos-estetica', name: 'Estética', segments: ['AESTHETICS'] },
  ]

  for (const cat of productCategories) {
    await prisma.catalogProductCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, segments: cat.segments },
      create: cat,
    })
  }

  // Buscar IDs das categorias criadas
  const svcCatList = await prisma.catalogServiceCategory.findMany()
  const svcCats = Object.fromEntries(svcCatList.map(c => [c.slug, c.id]))

  const prdCatList = await prisma.catalogProductCategory.findMany()
  const prdCatsBySlug = Object.fromEntries(prdCatList.map(c => [c.slug, c.id]))

  // Serviços do catálogo (~5 por segmento)
  const services = [
    // HAIR_SALON
    { slug: 'corte-feminino', name: 'Corte Feminino', description: 'Corte profissional com acabamento e finalização.', segments: ['HAIR_SALON'], categoryId: svcCats['corte'], suggestedDuration: 60, suggestedPrice: 80, priceType: 'STARTING_FROM', order: 1 },
    { slug: 'escova-progressiva', name: 'Escova Progressiva', description: 'Alisamento com produto profissional de longa duração.', segments: ['HAIR_SALON'], categoryId: svcCats['coloracao'], suggestedDuration: 120, suggestedPrice: 180, priceType: 'STARTING_FROM', order: 2 },
    { slug: 'coloracao-completa', name: 'Coloração Completa', description: 'Tintura completa com produtos de alta performance.', segments: ['HAIR_SALON'], categoryId: svcCats['coloracao'], suggestedDuration: 90, suggestedPrice: 150, priceType: 'STARTING_FROM', order: 3 },
    { slug: 'mechas-luzes', name: 'Mechas / Luzes', description: 'Técnica de iluminação com papel alumínio ou touca.', segments: ['HAIR_SALON'], categoryId: svcCats['coloracao'], suggestedDuration: 150, suggestedPrice: 200, priceType: 'STARTING_FROM', order: 4 },
    { slug: 'hidratacao-capilar', name: 'Hidratação Capilar', description: 'Tratamento intensivo de hidratação e nutrição dos fios.', segments: ['HAIR_SALON'], categoryId: svcCats['tratamento'], suggestedDuration: 60, suggestedPrice: 90, priceType: 'FIXED', order: 5 },
    // BARBERSHOP
    { slug: 'corte-masculino', name: 'Corte Masculino', description: 'Corte com máquina e tesoura, acabamento caprichado.', segments: ['BARBERSHOP'], categoryId: svcCats['corte'], suggestedDuration: 45, suggestedPrice: 50, priceType: 'FIXED', order: 1 },
    { slug: 'barba-completa', name: 'Barba Completa', description: 'Aparar, modelar e hidratar a barba com navalha.', segments: ['BARBERSHOP'], categoryId: svcCats['barba'], suggestedDuration: 30, suggestedPrice: 35, priceType: 'FIXED', order: 2 },
    { slug: 'corte-barba', name: 'Corte + Barba', description: 'Combo completo de corte masculino e barba.', segments: ['BARBERSHOP'], categoryId: svcCats['corte'], suggestedDuration: 60, suggestedPrice: 70, priceType: 'FIXED', order: 3 },
    { slug: 'pigmentacao-barba', name: 'Pigmentação de Barba', description: 'Cobertura de fios brancos com pigmento profissional.', segments: ['BARBERSHOP'], categoryId: svcCats['barba'], suggestedDuration: 30, suggestedPrice: 40, priceType: 'FIXED', order: 4 },
    { slug: 'design-sobrancelha-masc', name: 'Design de Sobrancelha', description: 'Modelagem masculina de sobrancelhas com pinça e linha.', segments: ['BARBERSHOP'], categoryId: svcCats['barba'], suggestedDuration: 20, suggestedPrice: 25, priceType: 'FIXED', order: 5 },
    // NAIL_DESIGN
    { slug: 'manicure', name: 'Manicure', description: 'Cuidado completo das unhas das mãos com esmaltação.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 60, suggestedPrice: 45, priceType: 'FIXED', order: 1 },
    { slug: 'pedicure', name: 'Pedicure', description: 'Cuidado completo das unhas dos pés com esmaltação.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 60, suggestedPrice: 55, priceType: 'FIXED', order: 2 },
    { slug: 'gel-unhas', name: 'Unhas em Gel', description: 'Alongamento e reforço com gel UV de longa duração.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 90, suggestedPrice: 120, priceType: 'STARTING_FROM', order: 3 },
    { slug: 'fibra-vidro', name: 'Fibra de Vidro', description: 'Alongamento resistente com fibra de vidro e gel.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 90, suggestedPrice: 130, priceType: 'STARTING_FROM', order: 4 },
    { slug: 'nail-art', name: 'Nail Art', description: 'Arte decorativa personalizada nas unhas.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 30, suggestedPrice: 30, priceType: 'STARTING_FROM', order: 5 },
    // AESTHETICS
    { slug: 'limpeza-pele', name: 'Limpeza de Pele', description: 'Higienização profunda com extração e hidratação final.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 60, suggestedPrice: 120, priceType: 'FIXED', order: 1 },
    { slug: 'peeling-facial', name: 'Peeling Facial', description: 'Renovação celular com ácidos de grau estético.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 45, suggestedPrice: 150, priceType: 'STARTING_FROM', order: 2 },
    { slug: 'massagem-relaxante', name: 'Massagem Relaxante', description: 'Massagem corporal com técnicas de relaxamento profundo.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-corporal'], suggestedDuration: 60, suggestedPrice: 130, priceType: 'FIXED', order: 3 },
    { slug: 'design-sobrancelha-fem', name: 'Design de Sobrancelha', description: 'Modelagem feminina com henna e definição de arco.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 30, suggestedPrice: 50, priceType: 'FIXED', order: 4 },
    { slug: 'lifting-cilios', name: 'Lifting de Cílios', description: 'Curvatura e coloração dos cílios com efeito duradouro.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 60, suggestedPrice: 110, priceType: 'FIXED', order: 5 },
  ]

  for (const svc of services) {
    await prisma.catalogService.upsert({
      where: { slug: svc.slug },
      update: { name: svc.name, description: svc.description, suggestedPrice: svc.suggestedPrice, suggestedDuration: svc.suggestedDuration },
      create: svc,
    })
  }

  // Produtos do catálogo (~5 por segmento)
  const products = [
    // HAIR_SALON
    { slug: 'shampoo-profissional', name: 'Shampoo Profissional', description: 'Shampoo de limpeza profunda para uso profissional.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 45, order: 1 },
    { slug: 'condicionador-profissional', name: 'Condicionador Profissional', description: 'Condicionador hidratante de uso profissional.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 45, order: 2 },
    { slug: 'mascara-capilar', name: 'Máscara Capilar', description: 'Máscara de nutrição e reconstrução dos fios.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 60, order: 3 },
    { slug: 'tinta-capilar', name: 'Tinta Capilar', description: 'Tinta profissional de alta cobertura e fixação.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 30, order: 4 },
    { slug: 'progressiva-profissional', name: 'Progressiva Profissional', description: 'Produto de alisamento profissional de longa duração.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 90, order: 5 },
    // BARBERSHOP
    { slug: 'pomada-capilar', name: 'Pomada Capilar', description: 'Pomada de fixação média para finalização masculina.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 35, order: 1 },
    { slug: 'oleo-barba', name: 'Óleo de Barba', description: 'Óleo hidratante e amolecedor para barba.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 40, order: 2 },
    { slug: 'shampoo-masculino', name: 'Shampoo Masculino', description: 'Shampoo de uso frequente para cabelos masculinos.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 28, order: 3 },
    { slug: 'cera-capilar', name: 'Cera Capilar', description: 'Cera de fixação forte para penteados masculinos.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 32, order: 4 },
    { slug: 'pos-barba', name: 'Pós-Barba', description: 'Loção hidratante e calmante para uso após barbeação.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 38, order: 5 },
    // NAIL_DESIGN
    { slug: 'esmalte-base', name: 'Base Coat', description: 'Base protetora para unhas antes da esmaltação.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 18, order: 1 },
    { slug: 'esmalte-colorido', name: 'Esmalte Colorido', description: 'Esmalte de longa duração em diversas cores.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 15, order: 2 },
    { slug: 'top-coat', name: 'Top Coat', description: 'Selante de acabamento brilhante e longa duração.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 20, order: 3 },
    { slug: 'gel-uv', name: 'Gel UV', description: 'Gel de alongamento e reforço para uso com cabine UV.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 85, order: 4 },
    { slug: 'removedor-unhas', name: 'Removedor de Esmalte', description: 'Removedor sem acetona para proteção das unhas.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 12, order: 5 },
    // AESTHETICS
    { slug: 'sabonete-facial', name: 'Sabonete Facial', description: 'Sabonete de limpeza para pele facial sensível.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 35, order: 1 },
    { slug: 'acido-glicolico', name: 'Ácido Glicólico', description: 'Ácido para peeling químico e renovação celular.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 70, order: 2 },
    { slug: 'creme-hidratante-facial', name: 'Creme Hidratante Facial', description: 'Creme de hidratação profunda para finalização.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 55, order: 3 },
    { slug: 'henna-sobrancelha', name: 'Henna para Sobrancelha', description: 'Henna de coloração e preenchimento de sobrancelhas.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 45, order: 4 },
    { slug: 'cola-cilios', name: 'Cola de Cílios', description: 'Cola profissional para aplicação de cílios e lifting.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 30, order: 5 },
  ]

  for (const prd of products) {
    await prisma.catalogProduct.upsert({
      where: { slug: prd.slug },
      update: { name: prd.name, description: prd.description, suggestedPrice: prd.suggestedPrice },
      create: prd,
    })
  }

  console.log('Seed do catalogo mestre concluido: 20 servicos + 20 produtos')
}
