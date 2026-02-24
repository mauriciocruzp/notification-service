import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

@Entity('notification_recipients')
@Index(['notification'])
export class NotificationRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Notification, (notification) => notification.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  /**
   * Identificador lógico del destinatario (id del sistema actual recibido por MQTT).
   * Se usa para filtrar por usuario autenticado y para el delivery por WebSocket.
   */
  @Column({ name: 'recipient_id', type: 'varchar', length: 255, nullable: true })
  recipientId: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 255, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 255, nullable: true })
  lastName: string | null;

  @Column({ name: 'second_last_name', type: 'varchar', length: 255, nullable: true })
  secondLastName: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
