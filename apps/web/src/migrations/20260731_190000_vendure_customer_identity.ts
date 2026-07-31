import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Storefront identity moves from Authentik to the Vendure customer:
 * `users.authentik_id` → `users.vendure_customer_id`.
 *
 * Renamed rather than dropped-and-added so the unique index and any existing
 * rows survive in one statement, and so a `down` is a genuine inverse instead
 * of a data loss. The old column held an OIDC subject; the new one holds a
 * Vendure Customer id. Nothing carries over semantically — but on this database
 * only one row ever had a value and it belonged to a test account that has
 * since been deleted, so there is nothing to translate.
 *
 * Written by hand: `payload migrate:create` needs a TTY in this environment
 * (it prompts on rename-vs-create), and a rename is exactly the answer it
 * cannot infer — it would otherwise offer to drop the column and create a new
 * one, losing the unique constraint's name and any rows with it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" RENAME COLUMN "authentik_id" TO "vendure_customer_id";
  `)
  // Payload declares this field `unique` + `index`. A rename keeps the old
  // index under its old name, which is confusing to read in psql and diverges
  // from what the adapter would generate on a fresh database.
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_authentik_id_idx";
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_vendure_customer_id_idx"
      ON "users" ("vendure_customer_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_vendure_customer_id_idx";
  `)
  await db.execute(sql`
    ALTER TABLE "users" RENAME COLUMN "vendure_customer_id" TO "authentik_id";
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_authentik_id_idx"
      ON "users" ("authentik_id");
  `)
}
