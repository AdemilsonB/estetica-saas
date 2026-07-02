import { PgBoss } from "pg-boss";

let boss: PgBoss | null = null;
let bossStarted = false;

export function getPgBoss(): PgBoss {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
      schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
    });
  }
  return boss;
}

// isInstalled() apenas verifica o schema no banco — não inicia os workers.
// Chamamos b.start() sempre para garantir que o agendador interno rode,
// especialmente após cold starts em ambiente serverless.
export async function startPgBoss(): Promise<PgBoss> {
  const b = getPgBoss();
  if (!bossStarted) {
    await b.start();
    bossStarted = true;
  }
  return b;
}
