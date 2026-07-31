import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Community invite tracking on the user: the code issued to a customer and when.
 *
 * Deliberately stored rather than minted on demand. Sharkey's registration is
 * closed except by invite, so a code is a bearer credential to a private
 * community — regenerating one per request would make any signed-in account an
 * invite generator. Persisting it makes the endpoint idempotent and leaves an
 * audit trail of who was let in and when.
 *
 * Hand-written for the same reason as the others here: `payload migrate:create`
 * needs a TTY in this environment.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sharkey_invite_code" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sharkey_invite_issued_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "sharkey_invite_issued_at";
  `)
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "sharkey_invite_code";
  `)
}
