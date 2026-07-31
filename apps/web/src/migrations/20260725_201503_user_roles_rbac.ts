import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'editor', 'customer');
  ALTER TYPE "public"."enum_pages_slug_history_reason" ADD VALUE 'edit-url';
  ALTER TYPE "public"."enum__pages_v_version_slug_history_reason" ADD VALUE 'edit-url';
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");`)

  // ---------------------------------------------------------------------------
  // Backfill. Without this every pre-existing user ends up with zero roles, and
  // since `hasRole` treats absence as "no permission" (deliberately), that would
  // lock everyone out of the Admin Panel — including the operator running it.
  //
  // Default posture is least privilege: everyone becomes `customer`. Only the
  // break-glass bootstrap account is promoted to `admin`, because it is the one
  // identity guaranteed to exist and to be controlled by the operator. Any other
  // staff account is promoted deliberately afterwards, in the Admin Panel.
  // ---------------------------------------------------------------------------
  await db.execute(sql`
    INSERT INTO "users_roles" ("order", "parent_id", "value")
    SELECT 0, u."id", 'customer'::"public"."enum_users_roles"
    FROM "users" u
    WHERE NOT EXISTS (
      SELECT 1 FROM "users_roles" r WHERE r."parent_id" = u."id"
    );
  `)

  const bootstrapAdminEmail = process.env.PAYLOAD_ADMIN_EMAIL || 'admin@example.com'

  await db.execute(sql`
    INSERT INTO "users_roles" ("order", "parent_id", "value")
    SELECT 1, u."id", 'admin'::"public"."enum_users_roles"
    FROM "users" u
    WHERE lower(u."email") = lower(${bootstrapAdminEmail})
      AND NOT EXISTS (
        SELECT 1 FROM "users_roles" r
        WHERE r."parent_id" = u."id" AND r."value" = 'admin'
      );
  `)

  const promoted = await db.execute(sql`
    SELECT count(*)::int AS n FROM "users_roles" WHERE "value" = 'admin';
  `)
  payload.logger.info(
    `[user_roles_rbac] Backfilled roles. Admin accounts: ${
      (promoted as unknown as { rows?: { n?: number }[] }).rows?.[0]?.n ?? 'unknown'
    }. All other users defaulted to 'customer' — promote staff in the Admin Panel.`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_roles" CASCADE;
  ALTER TABLE "pages_slug_history" ALTER COLUMN "reason" SET DATA TYPE text;
  DROP TYPE "public"."enum_pages_slug_history_reason";
  CREATE TYPE "public"."enum_pages_slug_history_reason" AS ENUM('move', 'rename', 'regenerate', 'restore', 'manual');
  ALTER TABLE "pages_slug_history" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_pages_slug_history_reason" USING "reason"::"public"."enum_pages_slug_history_reason";
  ALTER TABLE "_pages_v_version_slug_history" ALTER COLUMN "reason" SET DATA TYPE text;
  DROP TYPE "public"."enum__pages_v_version_slug_history_reason";
  CREATE TYPE "public"."enum__pages_v_version_slug_history_reason" AS ENUM('move', 'rename', 'regenerate', 'restore', 'manual');
  ALTER TABLE "_pages_v_version_slug_history" ALTER COLUMN "reason" SET DATA TYPE "public"."enum__pages_v_version_slug_history_reason" USING "reason"::"public"."enum__pages_v_version_slug_history_reason";
  DROP TYPE "public"."enum_users_roles";`)
}
