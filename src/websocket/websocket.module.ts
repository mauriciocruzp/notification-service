import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { algorithm: 'HS256' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [NotificationDeliveryService, NotificationsGateway],
  exports: [NotificationDeliveryService],
})
export class WebsocketModule {}
