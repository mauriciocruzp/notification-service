import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Notification } from './notification.entity';

@Entity('notification_recipients')
@Unique(['notificationId', 'recipient'])
@Index(['notificationId'])
@Index(['recipient', 'createdAt'])
@Index(['recipient', 'readAt'])
export class NotificationRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => Notification, (notification) => notification.recipients, {
    onDelete: 'CASCADE',
  })
  notification: Notification;

  @Column({ type: 'varchar', length: 255 })
  recipient: string;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
