import { DataSource } from 'typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationRecipient } from '../notifications/entities/notification-recipient.entity';

const dbUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/notifications';
const isProduction = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbUrl,
  entities: [Notification, NotificationRecipient],
  migrations: [__dirname + '/migrations/*.js', __dirname + '/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  // SSL configuration for AWS RDS
  ssl: dbUrl.includes('rds.amazonaws.com') || dbUrl.includes('sslmode=')
    ? {
        rejectUnauthorized: isProduction, // Only verify certs in production
      }
    : false,
});
