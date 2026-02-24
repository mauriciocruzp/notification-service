import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecipientDetailsColumns1739900000001 implements MigrationInterface {
  name = 'AddRecipientDetailsColumns1739900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_recipients"
        ADD COLUMN "recipient_id" varchar(255),
        ADD COLUMN "first_name" varchar(255),
        ADD COLUMN "last_name" varchar(255),
        ADD COLUMN "second_last_name" varchar(255),
        ADD COLUMN "email" varchar(255),
        ADD COLUMN "phone" varchar(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_recipients"
        DROP COLUMN "phone",
        DROP COLUMN "email",
        DROP COLUMN "second_last_name",
        DROP COLUMN "last_name",
        DROP COLUMN "first_name",
        DROP COLUMN "recipient_id",
    `);
  }
}

