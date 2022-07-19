import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateChannelLinkTable1658247150306 implements MigrationInterface {
    name = "CreateChannelLinkTable1658247150306"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "channel_links" (
                "slack_id" text NOT NULL,
                "discord_id" text NOT NULL,
                "discord_webhook_id" text NOT NULL,
                "discord_webhook_token" text NOT NULL,
                CONSTRAINT "UQ_e46fd27d30ae171f9d9070123cb" UNIQUE ("slack_id"),
                CONSTRAINT "UQ_e1673609cd86212b8260a83101f" UNIQUE ("discord_id"),
                PRIMARY KEY ("slack_id", "discord_id")
            ) STRICT
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "channel_links"
        `)
    }
}
