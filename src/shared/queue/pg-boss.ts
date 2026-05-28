import { PgBoss } from "pg-boss";

let boss: PgBoss | null = null;

export function getPgBoss(): PgBoss {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
      schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
    });
  }
  return boss;
}

export async function startPgBoss(): Promise<PgBoss> {
  const b = getPgBoss();
  if (await b.isInstalled()) return b;
  await b.start();
  return b;
}
