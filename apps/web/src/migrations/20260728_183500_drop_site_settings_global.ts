import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Retires the `site-settings` GLOBAL, now superseded by the per-tenant
 * `brand-settings` collection.
 *
 * Written by hand rather than generated. `payload migrate:create` asks an
 * interactive question here — whether the social-links enum is being *renamed*
 * from the global's enum or created fresh — and that prompt needs a real TTY.
 * The answer is "created fresh": the previous migration deliberately kept both
 * structures alive at once so it could copy the name, logo and footer across.
 * This migration only removes what is now unused.
 *
 * Safe to run: the preceding migration has already copied every value it held.
 * `down()` recreates the structure but NOT the data — brand-settings is the
 * source of truth from here on.
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Guard rather than assume. If for any reason the copy did not happen, dropping
  // the source would destroy the only record of the site name and logo.
  const check = await db.execute(sql`SELECT count(*)::int AS n FROM "brand_settings";`)
  const settingsCount = (check as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n ?? 0
  if (settingsCount === 0) {
    throw new Error(
      'Refusing to drop site_settings: brand_settings is empty, so the previous ' +
        'migration did not copy the name/logo across. Investigate before re-running.',
    )
  }

  await db.execute(sql`
    DROP TABLE IF EXISTS "site_settings_nav_links" CASCADE;
    DROP TABLE IF EXISTS "site_settings_social_links" CASCADE;
    DROP TABLE IF EXISTS "site_settings" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_site_settings_social_links_platform";
  `)

  payload.logger.info(
    `[drop_site_settings] Global retired; ${settingsCount} per-brand settings row(s) in its place.`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_site_settings_social_links_platform" AS ENUM('twitter', 'github', 'discord', 'youtube', 'linkedin', 'instagram', 'mastodon', 'other');
    CREATE TABLE "site_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_name" varchar DEFAULT 'Acme Commerce' NOT NULL,
      "enable_auth" boolean,
      "logo_id" integer,
      "footer_text" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
    CREATE TABLE "site_settings_nav_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "url" varchar NOT NULL,
      "open_in_new_tab" boolean DEFAULT false
    );
    CREATE TABLE "site_settings_social_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "platform" "public"."enum_site_settings_social_links_platform" NOT NULL,
      "url" varchar NOT NULL
    );
    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "site_settings_nav_links" ADD CONSTRAINT "site_settings_nav_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  `)
}
