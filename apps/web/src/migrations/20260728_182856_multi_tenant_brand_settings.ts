import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brand_settings_social_links_platform" AS ENUM('twitter', 'github', 'discord', 'youtube', 'linkedin', 'instagram', 'mastodon', 'other');
  CREATE TABLE "users_tenants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL
  );
  
  CREATE TABLE "tenants_hostnames" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hostname" varchar NOT NULL
  );
  
  CREATE TABLE "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"domain" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brand_settings_nav_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"open_in_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "brand_settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_brand_settings_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "brand_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"site_name" varchar NOT NULL,
  	"tagline" varchar,
  	"enable_auth" boolean,
  	"logo_id" integer,
  	"footer_text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pages" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_tenant_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tenants_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brand_settings_id" integer;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenants_hostnames" ADD CONSTRAINT "tenants_hostnames_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_settings_nav_links" ADD CONSTRAINT "brand_settings_nav_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_settings_social_links" ADD CONSTRAINT "brand_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_settings" ADD CONSTRAINT "brand_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brand_settings" ADD CONSTRAINT "brand_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_tenants_order_idx" ON "users_tenants" USING btree ("_order");
  CREATE INDEX "users_tenants_parent_id_idx" ON "users_tenants" USING btree ("_parent_id");
  CREATE INDEX "users_tenants_tenant_idx" ON "users_tenants" USING btree ("tenant_id");
  CREATE INDEX "tenants_hostnames_order_idx" ON "tenants_hostnames" USING btree ("_order");
  CREATE INDEX "tenants_hostnames_parent_id_idx" ON "tenants_hostnames" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tenants_code_idx" ON "tenants" USING btree ("code");
  CREATE INDEX "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX "brand_settings_nav_links_order_idx" ON "brand_settings_nav_links" USING btree ("_order");
  CREATE INDEX "brand_settings_nav_links_parent_id_idx" ON "brand_settings_nav_links" USING btree ("_parent_id");
  CREATE INDEX "brand_settings_social_links_order_idx" ON "brand_settings_social_links" USING btree ("_order");
  CREATE INDEX "brand_settings_social_links_parent_id_idx" ON "brand_settings_social_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "brand_settings_tenant_idx" ON "brand_settings" USING btree ("tenant_id");
  CREATE INDEX "brand_settings_logo_idx" ON "brand_settings" USING btree ("logo_id");
  CREATE INDEX "brand_settings_updated_at_idx" ON "brand_settings" USING btree ("updated_at");
  CREATE INDEX "brand_settings_created_at_idx" ON "brand_settings" USING btree ("created_at");
  ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brand_settings_fk" FOREIGN KEY ("brand_settings_id") REFERENCES "public"."brand_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_tenant_idx" ON "pages" USING btree ("tenant_id");
  CREATE INDEX "_pages_v_version_version_tenant_idx" ON "_pages_v" USING btree ("version_tenant_id");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_brand_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("brand_settings_id");`)

  // ---------------------------------------------------------------------------
  // Data migration.
  //
  // The schema above adds only a NULLABLE `tenant_id`, so without this every
  // existing page would belong to no brand — invisible in a tenant-filtered admin
  // and unreachable by a tenant-scoped query. The backfill is not a nicety here;
  // it is the difference between a working site and an empty one.
  // ---------------------------------------------------------------------------

  // 1. The brands. `code` is the join key to the static routing map in
  //    src/lib/tenants.ts, which a test asserts stays in agreement.
  await db.execute(sql`
    INSERT INTO "tenants" ("name", "code", "domain", "updated_at", "created_at")
    VALUES
      ('Acme Commerce', 'tlr', 'example.com', now(), now()),
      ('Vertex Supply',     'tgp', 'vertexsupply.example', now(), now()),
      ('Orbit Labs',  'snm', 'orbitlabs.example', now(), now())
    ON CONFLICT ("code") DO NOTHING;
  `)

  // 2. Pages carry a tenant-prefixed slug (`snm/about`) because pages_slug_idx is
  //    UNIQUE on slug alone and this plugin does not scope uniqueness per tenant.
  //    That prefix is the authoritative signal for which brand owns the page.
  await db.execute(sql`
    UPDATE "pages" p
    SET "tenant_id" = t."id"
    FROM "tenants" t
    WHERE p."tenant_id" IS NULL
      AND split_part(p."slug", '/', 1) = t."code";
  `)

  // 3. Anything still unassigned predates tenancy (bare slugs: home, about,
  //    community, courses). Exactly one brand may claim those — Acme Commerce,
  //    matching `ownsLegacyUnprefixedPages` in the routing map.
  await db.execute(sql`
    UPDATE "pages"
    SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "code" = 'tlr')
    WHERE "tenant_id" IS NULL;
  `)

  // Version rows are filtered the same way; leaving them null makes the editor's
  // version history look empty for every page.
  await db.execute(sql`
    UPDATE "_pages_v" v
    SET "version_tenant_id" = p."tenant_id"
    FROM "pages" p
    WHERE v."parent_id" = p."id" AND v."version_tenant_id" IS NULL;
  `)

  // 4. One brand-settings row per tenant. Acme Commerce inherits the old
  //    singleton global's name, logo and footer; the other two start from their
  //    own names rather than silently wearing TLR's identity — which was the
  //    original defect.
  await db.execute(sql`
    INSERT INTO "brand_settings" ("tenant_id", "site_name", "logo_id", "footer_text", "updated_at", "created_at")
    SELECT
      t."id",
      CASE WHEN t."code" = 'tlr' THEN COALESCE(s."site_name", t."name") ELSE t."name" END,
      CASE WHEN t."code" = 'tlr' THEN s."logo_id" ELSE NULL END,
      CASE WHEN t."code" = 'tlr' THEN s."footer_text" ELSE NULL END,
      now(), now()
    FROM "tenants" t
    LEFT JOIN "site_settings" s ON true
    WHERE NOT EXISTS (
      SELECT 1 FROM "brand_settings" b WHERE b."tenant_id" = t."id"
    );
  `)

  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM "tenants")::int AS tenants,
      (SELECT count(*) FROM "brand_settings")::int AS settings,
      (SELECT count(*) FROM "pages" WHERE "tenant_id" IS NULL)::int AS orphans;
  `)
  const row = (counts as unknown as { rows?: Array<Record<string, number>> }).rows?.[0]
  payload.logger.info(
    `[multi_tenant] tenants=${row?.tenants} brand-settings=${row?.settings} ` +
      `pages with no tenant=${row?.orphans} (must be 0)`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_tenants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenants_hostnames" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "brand_settings_nav_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "brand_settings_social_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "brand_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_tenants" CASCADE;
  DROP TABLE "tenants_hostnames" CASCADE;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "brand_settings_nav_links" CASCADE;
  DROP TABLE "brand_settings_social_links" CASCADE;
  DROP TABLE "brand_settings" CASCADE;
  ALTER TABLE "pages" DROP CONSTRAINT "pages_tenant_id_tenants_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_tenant_id_tenants_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tenants_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brand_settings_fk";
  
  DROP INDEX "pages_tenant_idx";
  DROP INDEX "_pages_v_version_version_tenant_idx";
  DROP INDEX "payload_locked_documents_rels_tenants_id_idx";
  DROP INDEX "payload_locked_documents_rels_brand_settings_id_idx";
  ALTER TABLE "pages" DROP COLUMN "tenant_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_tenant_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tenants_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brand_settings_id";
  DROP TYPE "public"."enum_brand_settings_social_links_platform";`)
}
