import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Per-activity completion tracking: `enrollments.completedActivities`
 * (hasMany relationship → activities), which Payload stores in a rels table.
 *
 * Written by hand rather than generated. `payload migrate:create` asks an
 * interactive rename question here — it offers to "rename" the dropped
 * `site_settings_*` tables into `enrollments_rels` — and that prompt needs a
 * real TTY. The answer is "create table": those globals were deliberately
 * dropped in 20260728_183500 and share nothing with this relationship.
 *
 * Shape mirrors `course_sections_rels` exactly (the existing hasMany →
 * activities table), so Payload's postgres adapter reads it as its own.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "enrollments_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "activities_id" integer
    );

    ALTER TABLE "enrollments_rels"
      DROP CONSTRAINT IF EXISTS "enrollments_rels_parent_fk";
    ALTER TABLE "enrollments_rels"
      ADD CONSTRAINT "enrollments_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."enrollments"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "enrollments_rels"
      DROP CONSTRAINT IF EXISTS "enrollments_rels_activities_fk";
    ALTER TABLE "enrollments_rels"
      ADD CONSTRAINT "enrollments_rels_activities_fk"
      FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "enrollments_rels_order_idx" ON "enrollments_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "enrollments_rels_parent_idx" ON "enrollments_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "enrollments_rels_path_idx" ON "enrollments_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "enrollments_rels_activities_id_idx" ON "enrollments_rels" USING btree ("activities_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "enrollments_rels" CASCADE;`)
}
