import { Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka-consumer.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [NotificationsModule, WebsocketModule],
  providers: [KafkaConsumerService],
})
export class KafkaModule {}
