import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MqttModule } from './mqtt/mqtt.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const dbUrl = config.get<string>('database.url');
        const isProduction = process.env.NODE_ENV === 'production';
        const isRds = dbUrl?.includes('rds.amazonaws.com') || dbUrl?.includes('sslmode=');
        
        return {
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: false,
          logging: process.env.NODE_ENV === 'development',
          // SSL configuration for AWS RDS
          ssl: isRds
            ? {
                rejectUnauthorized: isProduction, // Only verify certs in production
              }
            : false,
          // Connection timeout settings
          connectTimeoutMS: 10000, // 10 seconds
          extra: {
            // Connection pool settings
            max: 10, // Maximum pool size
            connectionTimeoutMillis: 10000, // 10 seconds timeout
            idleTimeoutMillis: 30000, // 30 seconds idle timeout
          },
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: (config.get<number>('throttler.ttl') ?? 60) * 1000,
            limit: config.get<number>('throttler.limit') ?? 100,
          },
        ],
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    NotificationsModule,
    WebsocketModule,
    MqttModule,
    // AppController/Service kept for health or root
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
