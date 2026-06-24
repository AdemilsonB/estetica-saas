import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, PlanName, SubscriptionStatus } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { seedCatalog } from "./seed-catalog.mjs";

loadEnv({ path: ".env.local", override: false });
loadEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "saas-estetica-demo" },
    update: {
      name: "SaaS Estetica Demo",
    },
    create: {
      name: "SaaS Estetica Demo",
      slug: "saas-estetica-demo",
    },
  });

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { plan: PlanName.PRO, status: SubscriptionStatus.ACTIVE },
    create: {
      tenantId: tenant.id,
      plan: PlanName.PRO,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date("2099-12-31"),
    },
  });

  const ownerPermissions = [
    "appointments:view",
    "appointments:create",
    "appointments:edit",
    "appointments:delete",
    "customers:view",
    "customers:create",
    "customers:edit",
    "financial:view",
    "financial:manage",
    "users:view",
    "users:invite",
    "users:manage",
    "services:view",
    "services:manage",
  ];

  const owner = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "owner@saasestetica.dev",
      },
    },
    update: {
      name: "Owner Demo",
      role: UserRole.OWNER,
      permissions: ownerPermissions,
    },
    create: {
      tenantId: tenant.id,
      email: "owner@saasestetica.dev",
      name: "Owner Demo",
      role: UserRole.OWNER,
      permissions: ownerPermissions,
    },
  });

  const haircut = await prisma.service.upsert({
    where: {
      id: "svc-corte-feminino-demo",
    },
    update: {
      tenantId: tenant.id,
      name: "Corte Feminino",
      duration: 60,
      price: 120,
      active: true,
    },
    create: {
      id: "svc-corte-feminino-demo",
      tenantId: tenant.id,
      name: "Corte Feminino",
      duration: 60,
      price: 120,
      active: true,
    },
  });

  const manicure = await prisma.service.upsert({
    where: {
      id: "svc-manicure-demo",
    },
    update: {
      tenantId: tenant.id,
      name: "Manicure Completa",
      duration: 45,
      price: 75,
      active: true,
    },
    create: {
      id: "svc-manicure-demo",
      tenantId: tenant.id,
      name: "Manicure Completa",
      duration: 45,
      price: 75,
      active: true,
    },
  });

  const customer = await prisma.customer.upsert({
    where: {
      id: "cus-cliente-demo",
    },
    update: {
      tenantId: tenant.id,
      name: "Cliente Demo",
      phone: "+5511999999999",
      email: "cliente@demo.com",
      tags: ["VIP", "Recorrente"],
    },
    create: {
      id: "cus-cliente-demo",
      tenantId: tenant.id,
      name: "Cliente Demo",
      phone: "+5511999999999",
      email: "cliente@demo.com",
      notes: "Cliente inicial para ambiente de desenvolvimento.",
      tags: ["VIP", "Recorrente"],
    },
  });

  console.log(
    JSON.stringify(
      {
        tenantId: tenant.id,
        ownerId: owner.id,
        serviceIds: [haircut.id, manicure.id],
        customerId: customer.id,
      },
      null,
      2,
    ),
  );

  await seedCatalog(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
