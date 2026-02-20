import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationDeliveryService } from './notification-delivery.service';

interface AuthenticatedSocket {
  recipient?: string;
}

@WebSocketGateway({
  cors: { origin: true },
  path: '/ws',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  afterInit(server: Server): void {
    this.delivery.setServer(server);
  }

  async handleConnection(client: import('socket.io').Socket & AuthenticatedSocket): Promise<void> {
    const token =
      client.handshake.auth?.token ??
      client.handshake.query?.token ??
      client.handshake.headers?.authorization?.replace?.('Bearer ', '');

    if (!token) {
      this.logger.warn('WebSocket connection without token, disconnecting');
      client.disconnect();
      return;
    }

    try {
      const secret = this.config.get<string>('jwt.secret');
      const payload = this.jwt.verify(token, { secret });
      const credentialId = payload.credentialId ?? parseInt(payload.sub, 10);
      if (Number.isNaN(credentialId)) {
        client.disconnect();
        return;
      }
      const recipient = String(credentialId);
      client.recipient = recipient;
      this.delivery.register(recipient, client.id);
      this.logger.debug(`Socket ${client.id} connected for recipient ${recipient}`);
    } catch {
      this.logger.warn('WebSocket invalid token, disconnecting');
      client.disconnect();
    }
  }

  handleDisconnect(client: import('socket.io').Socket & AuthenticatedSocket): void {
    this.delivery.unregister(client.id, client.recipient);
  }
}
