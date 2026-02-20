import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, KafkaConfig } from 'kafkajs';
import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js';
import { NotificationsService } from '../notifications/notifications.service';
import {
  parseDomainEvent,
  buildNotificationTitle,
  DomainEvent,
} from './kafka-domain.event';
import { NotificationDeliveryService } from '../websocket/notification-delivery.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka | null = null;
  private consumer: Awaited<ReturnType<Kafka['consumer']>> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.config.get<string[]>('kafka.brokers');
    const groupId = this.config.get<string>('kafka.groupId');
    const topic = this.config.get<string>('kafka.topic');
    const ssl = this.config.get<boolean>('kafka.ssl');
    const authMode = this.config.get<'iam' | 'sasl' | undefined>('kafka.authMode');
    const awsRegion = this.config.get<string>('kafka.awsRegion');
    const sasl = this.config.get<{
      mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512' | 'aws';
      username?: string;
      password?: string;
      awsRegion?: string;
    }>('kafka.sasl');

    if (!brokers?.length) {
      this.logger.warn('KAFKA_BROKERS not set; Kafka consumer disabled');
      return;
    }

    // Construir configuración SASL según el mecanismo
    let saslConfig: KafkaConfig['sasl'] = undefined;
    
    if (authMode === 'iam' && awsRegion) {
      saslConfig = {
        mechanism: 'oauthbearer',
        oauthBearerProvider: async () => {
          const res = await generateAuthToken({ region: awsRegion });
          return { value: res.token };
        },
      };
    } else if (sasl?.username && sasl?.password && sasl.mechanism !== 'aws') {
      // Construir según el mecanismo específico para satisfacer TypeScript
      if (sasl.mechanism === 'plain') {
        saslConfig = {
          mechanism: 'plain',
          username: sasl.username,
          password: sasl.password,
        };
      } else if (sasl.mechanism === 'scram-sha-256') {
        saslConfig = {
          mechanism: 'scram-sha-256',
          username: sasl.username,
          password: sasl.password,
        };
      } else if (sasl.mechanism === 'scram-sha-512') {
        saslConfig = {
          mechanism: 'scram-sha-512',
          username: sasl.username,
          password: sasl.password,
        };
      }
    }

    const kafkaConfig: KafkaConfig = {
      clientId: 'notification-service',
      brokers,
      ssl: ssl
        ? {
            rejectUnauthorized: true,
          }
        : undefined,
      sasl: saslConfig,
    };

    if (ssl) {
      this.logger.log('Kafka SSL/TLS enabled');
    }
    if (authMode === 'iam' && awsRegion) {
      this.logger.log(`Kafka IAM authentication enabled (region: ${awsRegion})`);
    } else if (sasl?.username && sasl?.password && sasl.mechanism !== 'aws') {
      this.logger.log(`Kafka SASL authentication enabled (${sasl.mechanism})`);
    }

    this.kafka = new Kafka(kafkaConfig);

    this.consumer = this.kafka.consumer({ groupId: groupId! });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: topic!, fromBeginning: false });

      await this.consumer.run({
        eachMessage: async ({ topic: t, partition, message }) => {
          const raw = message.value?.toString();
          if (!raw) return;

          const event = parseDomainEvent(raw);
          if (!event) {
            this.logger.warn(`Invalid message on ${t}/${partition}, skipping`);
            return;
          }

          try {
            await this.handleEvent(event);
          } catch (err) {
            this.logger.error(`Error processing message: ${err}`);
            throw err;
          }
        },
      });

      this.logger.log(`Kafka consumer subscribed to ${topic}`);
    } catch (err: any) {
      this.logger.error(
        `Kafka connection failed (app will run without consumer): ${err?.message ?? err}. ` +
          'Check GUIA_CONFIGURACION_MSK.md → Connection timeout (public access, security group, bootstrap string).',
      );
      if (this.consumer) {
        await this.consumer.disconnect().catch(() => {});
        this.consumer = null;
      }
      this.kafka = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
    this.kafka = null;
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    if (!event.recipients?.length) {
      this.logger.debug(`No recipients for event ${event.eventType}, skipping`);
      return;
    }

    const title = buildNotificationTitle(event.eventType, event.payload.summary);
    const occurredAt = new Date(event.occurredAt);

    const recipients = event.recipients.map((r) => String(r));

    const { notification, recipients: savedRecipients } =
      await this.notificationsService.createNotificationWithRecipients(
        {
          type: event.eventType,
          channelType: event.channelType,
          title,
          body: event.payload.summary ?? null,
          payload: event.payload as Record<string, unknown>,
          occurredAt,
        },
        recipients,
      );

    if (event.channelType === 'IN_APP') {
      for (const recipientEntity of savedRecipients) {
        const recipient = recipientEntity.recipient;
        this.delivery.emitToUser(recipient, 'new_notification', this.toPayload(notification, recipientEntity));
      }
    }
  }

  private toPayload(notification: any, recipient: any): Record<string, unknown> {
    return {
      notification: {
        id: notification.id,
        type: notification.type,
        channelType: notification.channelType,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
        occurredAt: notification.occurredAt,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      },
      recipient: {
        id: recipient.id,
        recipient: recipient.recipient,
        readAt: recipient.readAt,
        createdAt: recipient.createdAt,
        updatedAt: recipient.updatedAt,
      },
    };
  }
}
