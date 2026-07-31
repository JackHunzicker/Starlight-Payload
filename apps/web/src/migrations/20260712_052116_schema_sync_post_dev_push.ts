import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_account_type" AS ENUM('b2c', 'b2b');
  CREATE TYPE "public"."enum_puck_ai_context_category" AS ENUM('brand', 'tone', 'product', 'industry', 'technical', 'patterns', 'other');
  CREATE TYPE "public"."enum_site_settings_social_links_platform" AS ENUM('twitter', 'github', 'discord', 'youtube', 'linkedin', 'instagram', 'mastodon', 'other');
  CREATE TABLE "community_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "community" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"content" jsonb,
  	"author_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "puck_ai_prompts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"prompt" varchar NOT NULL,
  	"category" varchar,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "puck_ai_context" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"content" varchar NOT NULL,
  	"category" "enum_puck_ai_context_category",
  	"enabled" boolean DEFAULT true,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  	"platform" "enum_site_settings_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar DEFAULT 'Acme Commerce' NOT NULL,
  	"enable_auth" boolean,
  	"logo_id" integer,
  	"footer_text" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "authentik_id" varchar;
  ALTER TABLE "users" ADD COLUMN "name" varchar;
  ALTER TABLE "users" ADD COLUMN "account_type" "enum_users_account_type" DEFAULT 'b2c';
  ALTER TABLE "users" ADD COLUMN "has_library_access" boolean DEFAULT false;
  ALTER TABLE "courses" ADD COLUMN "slug" varchar NOT NULL;
  ALTER TABLE "course_sections" ADD COLUMN "description" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "puck_ai_prompts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "puck_ai_context_id" integer;
  ALTER TABLE "community_tags" ADD CONSTRAINT "community_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "community" ADD CONSTRAINT "community_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_nav_links" ADD CONSTRAINT "site_settings_nav_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "community_tags_order_idx" ON "community_tags" USING btree ("_order");
  CREATE INDEX "community_tags_parent_id_idx" ON "community_tags" USING btree ("_parent_id");
  CREATE INDEX "community_author_idx" ON "community" USING btree ("author_id");
  CREATE INDEX "community_updated_at_idx" ON "community" USING btree ("updated_at");
  CREATE INDEX "community_created_at_idx" ON "community" USING btree ("created_at");
  CREATE INDEX "puck_ai_prompts_updated_at_idx" ON "puck_ai_prompts" USING btree ("updated_at");
  CREATE INDEX "puck_ai_prompts_created_at_idx" ON "puck_ai_prompts" USING btree ("created_at");
  CREATE INDEX "puck_ai_context_updated_at_idx" ON "puck_ai_context" USING btree ("updated_at");
  CREATE INDEX "puck_ai_context_created_at_idx" ON "puck_ai_context" USING btree ("created_at");
  CREATE INDEX "site_settings_nav_links_order_idx" ON "site_settings_nav_links" USING btree ("_order");
  CREATE INDEX "site_settings_nav_links_parent_id_idx" ON "site_settings_nav_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_social_links_order_idx" ON "site_settings_social_links" USING btree ("_order");
  CREATE INDEX "site_settings_social_links_parent_id_idx" ON "site_settings_social_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_logo_idx" ON "site_settings" USING btree ("logo_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_puck_ai_prompts_fk" FOREIGN KEY ("puck_ai_prompts_id") REFERENCES "public"."puck_ai_prompts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_puck_ai_context_fk" FOREIGN KEY ("puck_ai_context_id") REFERENCES "public"."puck_ai_context"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "users_authentik_id_idx" ON "users" USING btree ("authentik_id");
  CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
  CREATE INDEX "payload_locked_documents_rels_community_id_idx" ON "payload_locked_documents_rels" USING btree ("community_id");
  CREATE INDEX "payload_locked_documents_rels_puck_ai_prompts_id_idx" ON "payload_locked_documents_rels" USING btree ("puck_ai_prompts_id");
  CREATE INDEX "payload_locked_documents_rels_puck_ai_context_id_idx" ON "payload_locked_documents_rels" USING btree ("puck_ai_context_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "community_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "community" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "puck_ai_prompts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "puck_ai_context" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_nav_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_social_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "community_tags" CASCADE;
  DROP TABLE "community" CASCADE;
  DROP TABLE "puck_ai_prompts" CASCADE;
  DROP TABLE "puck_ai_context" CASCADE;
  DROP TABLE "site_settings_nav_links" CASCADE;
  DROP TABLE "site_settings_social_links" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_community_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_puck_ai_prompts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_puck_ai_context_fk";
  
  DROP INDEX "users_authentik_id_idx";
  DROP INDEX "courses_slug_idx";
  DROP INDEX "payload_locked_documents_rels_community_id_idx";
  DROP INDEX "payload_locked_documents_rels_puck_ai_prompts_id_idx";
  DROP INDEX "payload_locked_documents_rels_puck_ai_context_id_idx";
  ALTER TABLE "users" DROP COLUMN "authentik_id";
  ALTER TABLE "users" DROP COLUMN "name";
  ALTER TABLE "users" DROP COLUMN "account_type";
  ALTER TABLE "users" DROP COLUMN "has_library_access";
  ALTER TABLE "courses" DROP COLUMN "slug";
  ALTER TABLE "course_sections" DROP COLUMN "description";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "community_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "puck_ai_prompts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "puck_ai_context_id";
  DROP TYPE "public"."enum_users_account_type";
  DROP TYPE "public"."enum_puck_ai_context_category";
  DROP TYPE "public"."enum_site_settings_social_links_platform";`)
}
