import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_sync_status" AS ENUM('synced', 'syncing', 'error');
  CREATE TYPE "public"."enum_courses_access_level" AS ENUM('free', 'subscriber', 'premium');
  CREATE TYPE "public"."enum_courses_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_activities_media_type" AS ENUM('gltf', 'remotion', 'none');
  CREATE TYPE "public"."enum_enrollments_role" AS ENUM('student', 'teacher', 'ta', 'manager');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('active', 'completed', 'dropped');
  CREATE TYPE "public"."enum_pages_slug_history_reason" AS ENUM('move', 'rename', 'regenerate', 'restore', 'manual');
  CREATE TYPE "public"."enum_pages_page_layout" AS ENUM('default', 'landing', 'full-width');
  CREATE TYPE "public"."enum_pages_editor_version" AS ENUM('legacy', 'puck');
  CREATE TYPE "public"."enum_pages_conversion_tracking_conversion_type" AS ENUM('lead', 'registration', 'purchase', 'donation', 'newsletter', 'contact', 'custom');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_slug_history_reason" AS ENUM('move', 'rename', 'regenerate', 'restore', 'manual');
  CREATE TYPE "public"."enum__pages_v_version_page_layout" AS ENUM('default', 'landing', 'full-width');
  CREATE TYPE "public"."enum__pages_v_version_editor_version" AS ENUM('legacy', 'puck');
  CREATE TYPE "public"."enum__pages_v_version_conversion_tracking_conversion_type" AS ENUM('lead', 'registration', 'purchase', 'donation', 'newsletter', 'contact', 'custom');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('pages');
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendure_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"price" numeric,
  	"sku" varchar,
  	"sync_status" "enum_products_sync_status" DEFAULT 'synced',
  	"last_synced_at" timestamp(3) with time zone,
  	"sync_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" jsonb,
  	"thumbnail_id" integer,
  	"access_level" "enum_courses_access_level" DEFAULT 'free',
  	"status" "enum_courses_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "courses_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"course_sections_id" integer
  );
  
  CREATE TABLE "course_sections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "course_sections_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"activities_id" integer
  );
  
  CREATE TABLE "activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"content" jsonb,
  	"media_type" "enum_activities_media_type" DEFAULT 'none' NOT NULL,
  	"gltf_url" varchar,
  	"remotion_composition" varchar,
  	"order" numeric DEFAULT 0,
  	"duration" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"course_id" integer NOT NULL,
  	"role" "enum_enrollments_role" DEFAULT 'student' NOT NULL,
  	"enrolled_at" timestamp(3) with time zone,
  	"progress" numeric DEFAULT 0,
  	"status" "enum_enrollments_status" DEFAULT 'active',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "puck_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"category" varchar,
  	"content" jsonb NOT NULL,
  	"thumbnail" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_slug_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"changed_at" timestamp(3) with time zone,
  	"reason" "enum_pages_slug_history_reason"
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"page_layout" "enum_pages_page_layout" DEFAULT 'default',
  	"editor_version" "enum_pages_editor_version",
  	"is_homepage" boolean DEFAULT false,
  	"puck_data" jsonb,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"meta_noindex" boolean DEFAULT false,
  	"meta_nofollow" boolean DEFAULT false,
  	"meta_exclude_from_sitemap" boolean DEFAULT false,
  	"conversion_tracking_is_conversion_page" boolean DEFAULT false,
  	"conversion_tracking_conversion_type" "enum_pages_conversion_tracking_conversion_type",
  	"conversion_tracking_conversion_value" numeric DEFAULT 0,
  	"page_segment" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v_version_slug_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"changed_at" timestamp(3) with time zone,
  	"reason" "enum__pages_v_version_slug_history_reason",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_page_layout" "enum__pages_v_version_page_layout" DEFAULT 'default',
  	"version_editor_version" "enum__pages_v_version_editor_version",
  	"version_is_homepage" boolean DEFAULT false,
  	"version_puck_data" jsonb,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_noindex" boolean DEFAULT false,
  	"version_meta_nofollow" boolean DEFAULT false,
  	"version_meta_exclude_from_sitemap" boolean DEFAULT false,
  	"version_conversion_tracking_is_conversion_page" boolean DEFAULT false,
  	"version_conversion_tracking_conversion_type" "enum__pages_v_version_conversion_tracking_conversion_type",
  	"version_conversion_tracking_conversion_value" numeric DEFAULT 0,
  	"version_page_segment" varchar,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" integer,
  	"path_segment" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "products_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "courses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_sections_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activities_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enrollments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "puck_templates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_folders_id" integer;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_course_sections_fk" FOREIGN KEY ("course_sections_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_sections_rels" ADD CONSTRAINT "course_sections_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_sections_rels" ADD CONSTRAINT "course_sections_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_slug_history" ADD CONSTRAINT "pages_slug_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_version_slug_history" ADD CONSTRAINT "_pages_v_version_slug_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_folders" ADD CONSTRAINT "payload_folders_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "products_vendure_id_idx" ON "products" USING btree ("vendure_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "courses_thumbnail_idx" ON "courses" USING btree ("thumbnail_id");
  CREATE INDEX "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "courses" USING btree ("created_at");
  CREATE INDEX "courses_rels_order_idx" ON "courses_rels" USING btree ("order");
  CREATE INDEX "courses_rels_parent_idx" ON "courses_rels" USING btree ("parent_id");
  CREATE INDEX "courses_rels_path_idx" ON "courses_rels" USING btree ("path");
  CREATE INDEX "courses_rels_course_sections_id_idx" ON "courses_rels" USING btree ("course_sections_id");
  CREATE INDEX "course_sections_updated_at_idx" ON "course_sections" USING btree ("updated_at");
  CREATE INDEX "course_sections_created_at_idx" ON "course_sections" USING btree ("created_at");
  CREATE INDEX "course_sections_rels_order_idx" ON "course_sections_rels" USING btree ("order");
  CREATE INDEX "course_sections_rels_parent_idx" ON "course_sections_rels" USING btree ("parent_id");
  CREATE INDEX "course_sections_rels_path_idx" ON "course_sections_rels" USING btree ("path");
  CREATE INDEX "course_sections_rels_activities_id_idx" ON "course_sections_rels" USING btree ("activities_id");
  CREATE INDEX "activities_updated_at_idx" ON "activities" USING btree ("updated_at");
  CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");
  CREATE INDEX "enrollments_user_idx" ON "enrollments" USING btree ("user_id");
  CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_course_idx" ON "enrollments" USING btree ("user_id","course_id");
  CREATE INDEX "puck_templates_updated_at_idx" ON "puck_templates" USING btree ("updated_at");
  CREATE INDEX "puck_templates_created_at_idx" ON "puck_templates" USING btree ("created_at");
  CREATE INDEX "pages_slug_history_order_idx" ON "pages_slug_history" USING btree ("_order");
  CREATE INDEX "pages_slug_history_parent_id_idx" ON "pages_slug_history" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE INDEX "pages_folder_idx" ON "pages" USING btree ("folder_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_version_slug_history_order_idx" ON "_pages_v_version_slug_history" USING btree ("_order");
  CREATE INDEX "_pages_v_version_slug_history_parent_id_idx" ON "_pages_v_version_slug_history" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_pages_v_version_version_folder_idx" ON "_pages_v" USING btree ("version_folder_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "payload_folders_folder_type_order_idx" ON "payload_folders_folder_type" USING btree ("order");
  CREATE INDEX "payload_folders_folder_type_parent_idx" ON "payload_folders_folder_type" USING btree ("parent_id");
  CREATE INDEX "payload_folders_name_idx" ON "payload_folders" USING btree ("name");
  CREATE INDEX "payload_folders_folder_idx" ON "payload_folders" USING btree ("folder_id");
  CREATE INDEX "payload_folders_updated_at_idx" ON "payload_folders" USING btree ("updated_at");
  CREATE INDEX "payload_folders_created_at_idx" ON "payload_folders" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_sections_fk" FOREIGN KEY ("course_sections_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_puck_templates_fk" FOREIGN KEY ("puck_templates_id") REFERENCES "public"."puck_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_folders_fk" FOREIGN KEY ("payload_folders_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_course_sections_id_idx" ON "payload_locked_documents_rels" USING btree ("course_sections_id");
  CREATE INDEX "payload_locked_documents_rels_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("activities_id");
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_puck_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("puck_templates_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_payload_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_folders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "course_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "course_sections_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "activities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enrollments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "puck_templates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_slug_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_version_slug_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_folders_folder_type" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_folders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products" CASCADE;
  DROP TABLE "courses" CASCADE;
  DROP TABLE "courses_rels" CASCADE;
  DROP TABLE "course_sections" CASCADE;
  DROP TABLE "course_sections_rels" CASCADE;
  DROP TABLE "activities" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  DROP TABLE "puck_templates" CASCADE;
  DROP TABLE "pages_slug_history" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v_version_slug_history" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "payload_folders_folder_type" CASCADE;
  DROP TABLE "payload_folders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_courses_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_sections_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activities_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_enrollments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_puck_templates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_folders_fk";
  
  DROP INDEX "payload_locked_documents_rels_products_id_idx";
  DROP INDEX "payload_locked_documents_rels_courses_id_idx";
  DROP INDEX "payload_locked_documents_rels_course_sections_id_idx";
  DROP INDEX "payload_locked_documents_rels_activities_id_idx";
  DROP INDEX "payload_locked_documents_rels_enrollments_id_idx";
  DROP INDEX "payload_locked_documents_rels_puck_templates_id_idx";
  DROP INDEX "payload_locked_documents_rels_pages_id_idx";
  DROP INDEX "payload_locked_documents_rels_payload_folders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "products_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "courses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_sections_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activities_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "enrollments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "puck_templates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_folders_id";
  DROP TYPE "public"."enum_products_sync_status";
  DROP TYPE "public"."enum_courses_access_level";
  DROP TYPE "public"."enum_courses_status";
  DROP TYPE "public"."enum_activities_media_type";
  DROP TYPE "public"."enum_enrollments_role";
  DROP TYPE "public"."enum_enrollments_status";
  DROP TYPE "public"."enum_pages_slug_history_reason";
  DROP TYPE "public"."enum_pages_page_layout";
  DROP TYPE "public"."enum_pages_editor_version";
  DROP TYPE "public"."enum_pages_conversion_tracking_conversion_type";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_slug_history_reason";
  DROP TYPE "public"."enum__pages_v_version_page_layout";
  DROP TYPE "public"."enum__pages_v_version_editor_version";
  DROP TYPE "public"."enum__pages_v_version_conversion_tracking_conversion_type";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_payload_folders_folder_type";`)
}
