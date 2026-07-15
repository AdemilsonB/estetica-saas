import { PgBoss } from "pg-boss";

let boss: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

export function getPgBoss(): PgBoss {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
      schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
      // DIRECT_URL aponta pro Session Pooler do Supabase (necessário: pg-boss
      // usa LISTEN/NOTIFY e locks, que não funcionam no Transaction Pooler),
      // que tem um teto baixo de conexões simultâneas por projeto (15 no
      // tier Nano). Cada invocação serverless abre seu próprio pool — sem
      // limitar, poucas invocações concorrentes já estouram o teto do lado
      // do Supabase (EMAXCONNSESSION).
      max: 3,
    });
  }
  return boss;
}

// Promise-guard garante que boss.start() é chamado apenas uma vez mesmo em
// requisições serverless concorrentes na mesma instância Lambda.
export async function startPgBoss(): Promise<PgBoss> {
  if (!startPromise) {
    const b = getPgBoss();
    startPromise = b.start().then(() => b);
  }
  return startPromise;
}
