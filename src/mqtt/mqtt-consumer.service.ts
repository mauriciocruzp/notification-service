import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { NotificationsService } from '../notifications/notifications.service';
import { parseDomainEvent, DomainEvent } from './domain.event';
import { decryptRecipient } from './recipient-jwe';

import { NotificationDeliveryService } from '../websocket/notification-delivery.service';

@Injectable()
export class MqttConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttConsumerService.name);
  private client: MqttClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('mqtt.url');
    const topic = this.config.get<string>('mqtt.topic');
    const clientId = this.config.get<string>('mqtt.clientId');
    const username = this.config.get<string | undefined>('mqtt.username');
    const password = this.config.get<string | undefined>('mqtt.password');

    if (!url?.trim()) {
      this.logger.warn('MQTT_BROKER_URL not set; MQTT consumer disabled');
      return;
    }

    const keyB64 = this.config.get<string | undefined>('mqtt.recipientJweKeyB64Url');
    const keyPem = this.config.get<string | undefined>('mqtt.recipientJwePrivateKeyPem');
    if (!keyB64?.trim() && !keyPem?.trim()) {
      throw new Error(
        'Recipient JWE key required when using MQTT. Set MQTT_RECIPIENT_JWE_KEY_B64URL or MQTT_RECIPIENT_JWE_PRIVATE_KEY_PEM',
      );
    }

    const options: mqtt.IClientOptions = {
      clientId: clientId ?? 'notification-service',
      clean: true,
      reconnectPeriod: 5000,
    };
    if (username) options.username = username;
    if (password) options.password = password;

    try {
      this.client = mqtt.connect(url, options);

      this.client.on('connect', () => {
        this.logger.log('MQTT connected');
        this.client!.subscribe(topic!, (err) => {
          if (err) {
            this.logger.error(`MQTT subscribe error: ${err.message}`);
            return;
          }
          this.logger.log(`MQTT subscribed to ${topic}`);
        });
      });

      this.client.on('message', (topicName, payload) => {
        const raw = payload?.toString();
        if (!raw) return;

        this.logger.debug(`Raw message: ${raw}`);

        const event = parseDomainEvent(raw);
        if (!event) {
          this.logger.warn(`Invalid message on ${topicName}, skipping`);
          return;
        }

        this.handleEvent(event).catch((err) => {
          this.logger.error(`Error processing MQTT message: ${err}`);
        });
      });

      this.client.on('error', (err) => {
        this.logger.error(`MQTT error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.logger.warn('MQTT connection closed');
      });
    } catch (err: any) {
      this.logger.error(`MQTT connection failed: ${err?.message ?? err}`);
      if (this.client) {
        this.client.end(true);
        this.client = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    const jweConfig = {
      keyB64Url: this.config.get<string | undefined>('mqtt.recipientJweKeyB64Url'),
      privateKeyPem: this.config.get<string | undefined>('mqtt.recipientJwePrivateKeyPem'),
    };

    // Desencriptar y parsear el recipient JWE que viene en el evento MQTT
    const recipient = await decryptRecipient(event.recipient, jweConfig);
    this.logger.debug(`Handling event ${event.eventType} for recipient ${recipient.id}`);

    const occurredAt = new Date(event.occurredAt);

    const { notification, recipient: savedRecipient } =
      await this.notificationsService.createNotificationWithRecipient(
        {
          type: event.eventType,
          channelType: event.channelType,
          title: event.title,
          body: event.body ?? null,
          payload: event.payload as Record<string, unknown>,
          occurredAt,
        },
        recipient,
      );

    if (event.channelType === 'IN_APP') {
      const recipientId = savedRecipient.recipientId;
      if (!recipientId) {
        this.logger.warn(`NotificationRecipient ${savedRecipient.id} has no recipientId, skipping WebSocket emit`);
        return;
      }
      this.delivery.emitToUser(recipientId, 'new_notification', this.toPayload(notification, savedRecipient));
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
        recipient: recipient.recipientId,
        readAt: recipient.readAt,
        createdAt: recipient.createdAt,
        updatedAt: recipient.updatedAt,
      },
    };
  }
}
