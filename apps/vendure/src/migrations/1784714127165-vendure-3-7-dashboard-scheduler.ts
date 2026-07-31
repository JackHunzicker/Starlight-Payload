import {MigrationInterface, QueryRunner} from "typeorm";

export class Vendure37DashboardScheduler1784714127165 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_option_group" DROP CONSTRAINT "FK_a6e91739227bf4d442f23c52c75"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a6e91739227bf4d442f23c52c7"`, undefined);
        await queryRunner.query(`CREATE TABLE "asset_translation" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "languageCode" character varying NOT NULL, "name" character varying NOT NULL, "id" SERIAL NOT NULL, "baseId" integer, CONSTRAINT "PK_2f22e63eefeef14d245bdb956b6" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4eed4464adef51f53e1c7d8021" ON "asset_translation" ("baseId") `, undefined);
        await queryRunner.query(`CREATE TABLE "api_key_translation" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "languageCode" character varying NOT NULL, "name" character varying NOT NULL, "id" SERIAL NOT NULL, "baseId" integer, CONSTRAINT "PK_b703f4951cec9da71354120bd8a" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bf45bd67c7b3278d7e1f2f9517" ON "api_key_translation" ("baseId") `, undefined);
        await queryRunner.query(`CREATE TABLE "api_key" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lookupId" character varying NOT NULL, "apiKeyHash" character varying NOT NULL, "lastUsedAt" TIMESTAMP, "deletedAt" TIMESTAMP, "id" SERIAL NOT NULL, "ownerId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "UQ_ade30668b991772489bf875be5f" UNIQUE ("lookupId"), CONSTRAINT "UQ_3c254ac4ce1a6d4a26da30c5575" UNIQUE ("apiKeyHash"), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "scheduled_task_record" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "taskId" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "lockedAt" TIMESTAMP(3), "lastExecutedAt" TIMESTAMP(3), "manuallyTriggeredAt" TIMESTAMP(3), "lastResult" json, "id" SERIAL NOT NULL, CONSTRAINT "UQ_661876d97056cad9fd37eaa8774" UNIQUE ("taskId"), CONSTRAINT "PK_efd4b61a3b227f3eba94de32e4c" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "product_option_channels_channel" ("productOptionId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_be681a3bd2f92f17d084fa4375a" PRIMARY KEY ("productOptionId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_8dbe001861ca34ae8b687e6bae" ON "product_option_channels_channel" ("productOptionId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_717e7792b8f31c319b6c7b8135" ON "product_option_channels_channel" ("channelId") `, undefined);
        await queryRunner.query(`CREATE TABLE "product_option_group_channels_channel" ("productOptionGroupId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_ddad9696c49ebbc8032caf76fe3" PRIMARY KEY ("productOptionGroupId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4fbe6303db2827370c0ec2d027" ON "product_option_group_channels_channel" ("productOptionGroupId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d689965b8c58ebf316fce60fab" ON "product_option_group_channels_channel" ("channelId") `, undefined);
        await queryRunner.query(`CREATE TABLE "product_option_groups_product_option_group" ("productId" integer NOT NULL, "productOptionGroupId" integer NOT NULL, CONSTRAINT "PK_6a7a0291e226fbb0d4df828a483" PRIMARY KEY ("productId", "productOptionGroupId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9148fe2c2fd83f5b59d391088c" ON "product_option_groups_product_option_group" ("productId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9b03a92219b0684dbd4403e624" ON "product_option_groups_product_option_group" ("productOptionGroupId") `, undefined);
        await queryRunner.query(`CREATE TABLE "api_key_channels_channel" ("apiKeyId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_acb0650ccd9b2df593d1b4f1c52" PRIMARY KEY ("apiKeyId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_460b1afc096014ca2dc5a5f5aa" ON "api_key_channels_channel" ("apiKeyId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d37be6b22047f56ea87bea795b" ON "api_key_channels_channel" ("channelId") `, undefined);
        // Preserve the 3.5 single-valued fields before replacing them with the
        // translated and many-to-many structures introduced by Vendure 3.7.
        await queryRunner.query(`INSERT INTO "asset_translation" ("createdAt", "updatedAt", "languageCode", "name", "baseId") SELECT now(), now(), COALESCE((SELECT "defaultLanguageCode" FROM "channel" ORDER BY "id" LIMIT 1), 'en'), "name", "id" FROM "asset"`, undefined);
        await queryRunner.query(`INSERT INTO "product_option_groups_product_option_group" ("productId", "productOptionGroupId") SELECT "productId", "id" FROM "product_option_group" WHERE "productId" IS NOT NULL ON CONFLICT DO NOTHING`, undefined);
        await queryRunner.query(`INSERT INTO "product_option_group_channels_channel" ("productOptionGroupId", "channelId") SELECT DISTINCT pog."id", pc."channelId" FROM "product_option_group" pog JOIN "product_channels_channel" pc ON pc."productId" = pog."productId" WHERE pog."productId" IS NOT NULL ON CONFLICT DO NOTHING`, undefined);
        await queryRunner.query(`INSERT INTO "product_option_channels_channel" ("productOptionId", "channelId") SELECT DISTINCT po."id", pc."channelId" FROM "product_option" po JOIN "product_option_group" pog ON pog."id" = po."groupId" JOIN "product_channels_channel" pc ON pc."productId" = pog."productId" WHERE pog."productId" IS NOT NULL ON CONFLICT DO NOTHING`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group" DROP COLUMN "productId"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "name"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP CONSTRAINT "UQ_154f5c538b1576ccc277b1ed631"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset_translation" ADD CONSTRAINT "FK_4eed4464adef51f53e1c7d80212" FOREIGN KEY ("baseId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_translation" ADD CONSTRAINT "FK_bf45bd67c7b3278d7e1f2f95170" FOREIGN KEY ("baseId") REFERENCES "api_key"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" ADD CONSTRAINT "FK_74d2236b1de818d00bd3fd01602" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" ADD CONSTRAINT "FK_277972f4944205eb29127f9bb6c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" ADD CONSTRAINT "FK_8dbe001861ca34ae8b687e6baef" FOREIGN KEY ("productOptionId") REFERENCES "product_option"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" ADD CONSTRAINT "FK_717e7792b8f31c319b6c7b81352" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" ADD CONSTRAINT "FK_4fbe6303db2827370c0ec2d0276" FOREIGN KEY ("productOptionGroupId") REFERENCES "product_option_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" ADD CONSTRAINT "FK_d689965b8c58ebf316fce60fab2" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" ADD CONSTRAINT "FK_9148fe2c2fd83f5b59d391088c5" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" ADD CONSTRAINT "FK_9b03a92219b0684dbd4403e6246" FOREIGN KEY ("productOptionGroupId") REFERENCES "product_option_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" ADD CONSTRAINT "FK_460b1afc096014ca2dc5a5f5aa9" FOREIGN KEY ("apiKeyId") REFERENCES "api_key"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" ADD CONSTRAINT "FK_d37be6b22047f56ea87bea795b6" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" DROP CONSTRAINT "FK_d37be6b22047f56ea87bea795b6"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" DROP CONSTRAINT "FK_460b1afc096014ca2dc5a5f5aa9"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" DROP CONSTRAINT "FK_9b03a92219b0684dbd4403e6246"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" DROP CONSTRAINT "FK_9148fe2c2fd83f5b59d391088c5"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" DROP CONSTRAINT "FK_d689965b8c58ebf316fce60fab2"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" DROP CONSTRAINT "FK_4fbe6303db2827370c0ec2d0276"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" DROP CONSTRAINT "FK_717e7792b8f31c319b6c7b81352"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" DROP CONSTRAINT "FK_8dbe001861ca34ae8b687e6baef"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_277972f4944205eb29127f9bb6c"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_74d2236b1de818d00bd3fd01602"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_translation" DROP CONSTRAINT "FK_bf45bd67c7b3278d7e1f2f95170"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset_translation" DROP CONSTRAINT "FK_4eed4464adef51f53e1c7d80212"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD CONSTRAINT "UQ_154f5c538b1576ccc277b1ed631" UNIQUE ("emailAddress")`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" ADD "name" character varying`, undefined);
        await queryRunner.query(`UPDATE "asset" a SET "name" = COALESCE((SELECT at."name" FROM "asset_translation" at WHERE at."baseId" = a."id" ORDER BY at."id" LIMIT 1), '')`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" ALTER COLUMN "name" SET NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group" ADD "productId" integer`, undefined);
        await queryRunner.query(`UPDATE "product_option_group" pog SET "productId" = (SELECT MIN(link."productId") FROM "product_option_groups_product_option_group" link WHERE link."productOptionGroupId" = pog."id")`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d37be6b22047f56ea87bea795b"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_460b1afc096014ca2dc5a5f5aa"`, undefined);
        await queryRunner.query(`DROP TABLE "api_key_channels_channel"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b03a92219b0684dbd4403e624"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9148fe2c2fd83f5b59d391088c"`, undefined);
        await queryRunner.query(`DROP TABLE "product_option_groups_product_option_group"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d689965b8c58ebf316fce60fab"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4fbe6303db2827370c0ec2d027"`, undefined);
        await queryRunner.query(`DROP TABLE "product_option_group_channels_channel"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_717e7792b8f31c319b6c7b8135"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_8dbe001861ca34ae8b687e6bae"`, undefined);
        await queryRunner.query(`DROP TABLE "product_option_channels_channel"`, undefined);
        await queryRunner.query(`DROP TABLE "scheduled_task_record"`, undefined);
        await queryRunner.query(`DROP TABLE "api_key"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf45bd67c7b3278d7e1f2f9517"`, undefined);
        await queryRunner.query(`DROP TABLE "api_key_translation"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4eed4464adef51f53e1c7d8021"`, undefined);
        await queryRunner.query(`DROP TABLE "asset_translation"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a6e91739227bf4d442f23c52c7" ON "product_option_group" ("productId") `, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group" ADD CONSTRAINT "FK_a6e91739227bf4d442f23c52c75" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
   }

}
