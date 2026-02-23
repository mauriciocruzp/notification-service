import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';

export interface NotificationWithRecipient {
  notification: {
    id: string;
    type: string;
    channelType: string;
    title: string;
    body: string | null;
    payload: Record<string, unknown> | null;
    occurredAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  recipient: {
    id: string;
    recipient: string;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface PaginatedNotifications {
  data: NotificationWithRecipient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllForUser(
    recipient: string,
    page: number,
    limit: number,
    unreadOnly?: boolean,
  ): Promise<PaginatedNotifications> {
    const qb = this.recipientRepo
      .createQueryBuilder('nr')
      .innerJoinAndSelect('nr.notification', 'n')
      .where('nr.recipient = :recipient', { recipient })
      .andWhere('n.channelType = :channelType', { channelType: 'IN_APP' })
      .orderBy('n.occurredAt', 'DESC')
      .addOrderBy('nr.createdAt', 'DESC');

    if (unreadOnly) {
      qb.andWhere('nr.readAt IS NULL');
    }

    const [recipients, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data: NotificationWithRecipient[] = recipients.map((nr) => ({
      notification: {
        id: nr.notification.id,
        type: nr.notification.type,
        channelType: nr.notification.channelType,
        title: nr.notification.title,
        body: nr.notification.body,
        payload: nr.notification.payload,
        occurredAt: nr.notification.occurredAt,
        createdAt: nr.notification.createdAt,
        updatedAt: nr.notification.updatedAt,
      },
      recipient: {
        id: nr.id,
        recipient: nr.recipient,
        readAt: nr.readAt,
        createdAt: nr.createdAt,
        updatedAt: nr.updatedAt,
      },
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(notificationId: string, recipient: string): Promise<NotificationWithRecipient> {
    const recipientEntity = await this.recipientRepo.findOne({
      where: { notification: { id: notificationId }, recipient },
      relations: ['notification'],
    });

    if (!recipientEntity) {
      throw new NotFoundException('Notification not found');
    }

    if (recipientEntity.notification.channelType !== 'IN_APP') {
      throw new ForbiddenException('Not allowed to access this notification');
    }

    return {
      notification: {
        id: recipientEntity.notification.id,
        type: recipientEntity.notification.type,
        channelType: recipientEntity.notification.channelType,
        title: recipientEntity.notification.title,
        body: recipientEntity.notification.body,
        payload: recipientEntity.notification.payload,
        occurredAt: recipientEntity.notification.occurredAt,
        createdAt: recipientEntity.notification.createdAt,
        updatedAt: recipientEntity.notification.updatedAt,
      },
      recipient: {
        id: recipientEntity.id,
        recipient: recipientEntity.recipient,
        readAt: recipientEntity.readAt,
        createdAt: recipientEntity.createdAt,
        updatedAt: recipientEntity.updatedAt,
      },
    };
  }

  async markAsRead(notificationId: string, recipient: string): Promise<NotificationWithRecipient> {
    const recipientEntity = await this.recipientRepo.findOne({
      where: { notification: { id: notificationId }, recipient },
      relations: ['notification'],
    });

    if (!recipientEntity) {
      throw new NotFoundException('Notification not found');
    }

    if (!recipientEntity.readAt) {
      recipientEntity.readAt = new Date();
      await this.recipientRepo.save(recipientEntity);
    }

    return {
      notification: {
        id: recipientEntity.notification.id,
        type: recipientEntity.notification.type,
        channelType: recipientEntity.notification.channelType,
        title: recipientEntity.notification.title,
        body: recipientEntity.notification.body,
        payload: recipientEntity.notification.payload,
        occurredAt: recipientEntity.notification.occurredAt,
        createdAt: recipientEntity.notification.createdAt,
        updatedAt: recipientEntity.notification.updatedAt,
      },
      recipient: {
        id: recipientEntity.id,
        recipient: recipientEntity.recipient,
        readAt: recipientEntity.readAt,
        createdAt: recipientEntity.createdAt,
        updatedAt: recipientEntity.updatedAt,
      },
    };
  }

  async markAllAsRead(recipient: string): Promise<{ count: number }> {
    const result = await this.recipientRepo
      .createQueryBuilder()
      .update(NotificationRecipient)
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('recipient = :recipient', { recipient })
      .andWhere('read_at IS NULL')
      .andWhere(
        'notification_id IN (SELECT id FROM notifications WHERE channel_type = :channelType)',
        { channelType: 'IN_APP' },
      )
      .execute();
    return { count: result.affected ?? 0 };
  }

  async createNotificationWithRecipients(
    notificationData: {
      type: string;
      channelType: string;
      title: string;
      body?: string | null;
      payload?: Record<string, unknown> | null;
      occurredAt: Date;
    },
    recipients: string[],
  ): Promise<{ notification: Notification; recipients: NotificationRecipient[] }> {
    return await this.dataSource.transaction(async (manager) => {
      const notification = manager.create(Notification, notificationData);
      const savedNotification = await manager.save(Notification, notification);

      const recipientEntities = recipients.map((recipient) =>
        manager.create(NotificationRecipient, {
          notification: savedNotification,
          recipient,
        }),
      );
      const savedRecipients = await manager.save(NotificationRecipient, recipientEntities);

      return {
        notification: savedNotification,
        recipients: savedRecipients,
      };
    });
  }
}
