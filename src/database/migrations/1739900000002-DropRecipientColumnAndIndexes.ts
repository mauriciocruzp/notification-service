import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropRecipientColumnAndIndexes1739900000002 implements MigrationInterface {
  name = 'DropRecipientColumnAndIndexes1739900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índices antiguos basados en recipient si existen
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_recipients_recipient_read"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_recipients_recipient_created"`,
    );

    // Eliminar columna recipient si existe (modelo antiguo)
    await queryRunner.query(
      `ALTER TABLE "notification_recipients" DROP COLUMN IF EXISTS "recipient"`,
    );

    // Eliminar unique antiguo si existiera
    await queryRunner.query(
      `ALTER TABLE "notification_recipients" DROP CONSTRAINT IF EXISTS "UQ_notification_recipients_notification_recipient"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaurar columna recipient básica (sin datos enriquecidos)
    await queryRunner.query(
      `ALTER TABLE "notification_recipients" ADD COLUMN "recipient" varchar(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_recipients_notification_recipient" ON "notification_recipients" ("notification_id","recipient")`,
    );
  }
}

