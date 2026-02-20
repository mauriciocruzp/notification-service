import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsAndRecipients1739800000000 implements MigrationInterface {
  name = 'CreateNotificationsAndRecipients1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old table if exists (for fresh start)
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_recipients" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" varchar(128) NOT NULL,
        "channel_type" varchar(32) NOT NULL,
        "title" varchar(512) NOT NULL,
        "body" text,
        "payload" jsonb,
        "occurred_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    // Create notification_recipients table
    await queryRunner.query(`
      CREATE TABLE "notification_recipients" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL,
        "recipient" varchar(255) NOT NULL,
        "read_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_recipients_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_recipients_notification" FOREIGN KEY ("notification_id")
          REFERENCES "notifications"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_notification_recipients_notification_recipient" UNIQUE ("notification_id", "recipient")
      )
    `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_type" ON "notifications" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_channel_type" ON "notifications" ("channel_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_occurred_at" ON "notifications" ("occurred_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_recipients_notification_id" ON "notification_recipients" ("notification_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_recipients_recipient_created" ON "notification_recipients" ("recipient", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_recipients_recipient_read" ON "notification_recipients" ("recipient", "read_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notification_recipients_recipient_read"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_recipients_recipient_created"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_recipients_notification_id"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_occurred_at"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_channel_type"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_type"`);
    await queryRunner.query(`DROP TABLE "notification_recipients"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
