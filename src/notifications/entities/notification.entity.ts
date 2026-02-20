import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationRecipient } from '../entities/notification-recipient.entity';

@Entity('notifications')
@Index(['type'])
@Index(['channelType'])
@Index(['occurredAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'type', type: 'varchar', length: 128 })
  type: string;

  @Column({ name: 'channel_type', type: 'varchar', length: 32 })
  channelType: string;

  @Column({ type: 'varchar', length: 512 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => NotificationRecipient, (recipient) => recipient.notification, {
    cascade: true,
  })
  recipients: NotificationRecipient[];
}
