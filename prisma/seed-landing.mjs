import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false });
loadEnv();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Métricas da landing page
  const metrics = [
    { value: "+1.200", label: "salões ativos", order: 0 },
    { value: "98%",    label: "de satisfação", order: 1 },
    { value: "-40%",   label: "menos faltas",  order: 2 },
    { value: "24h",    label: "suporte humano", order: 3 },
  ];

  for (const m of metrics) {
    await prisma.landingMetric.upsert({
      where: { id: `metric-${m.order}` },
      update: { value: m.value, label: m.label, order: m.order, isActive: true },
      create: { id: `metric-${m.order}`, ...m, isActive: true },
    });
  }
  console.log(`✅ ${metrics.length} métricas inseridas`);

  // Depoimentos
  const testimonials = [
    {
      id: "testimonial-0",
      authorName: "Camila Ferreira",
      authorRole: "Studio Camila · São Paulo, SP",
      quote: "Antes eu perdia 3 horas por dia no telefone. Hoje acordo com a agenda cheia e só entro no salão para atender. O Agendê mudou minha vida.",
      rating: 5,
      avatarUrl: null,
      order: 0,
    },
    {
      id: "testimonial-1",
      authorName: "Juliana Ramos",
      authorRole: "Espaço JR Beauty · Curitiba, PR",
      quote: "As faltas caíram pela metade em dois meses. O lembrete automático no WhatsApp é incrível — as clientes adoram e eu não preciso fazer nada.",
      rating: 5,
      avatarUrl: null,
      order: 1,
    },
    {
      id: "testimonial-2",
      authorName: "Patricia Oliveira",
      authorRole: "Salão Bella Arte · Belo Horizonte, MG",
      quote: "Finalmente sei quanto faturei no mês sem precisar de planilha. O relatório financeiro me ajudou a descobrir que escova é meu serviço mais lucrativo.",
      rating: 5,
      avatarUrl: null,
      order: 2,
    },
  ];

  for (const t of testimonials) {
    await prisma.landingTestimonial.upsert({
      where: { id: t.id },
      update: { ...t },
      create: { ...t, isActive: true },
    });
  }
  console.log(`✅ ${testimonials.length} depoimentos inseridos`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
