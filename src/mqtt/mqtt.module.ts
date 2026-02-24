import { Module } from '@nestjs/common';
import { MqttConsumerService } from './mqtt-consumer.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [NotificationsModule, WebsocketModule],
  providers: [MqttConsumerService],
})
export class MqttModule {}
