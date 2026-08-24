import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './config/environment';
import { PrismaModule } from './common/infrastructure/prisma/prisma.module';
import { CacheModule } from './common/infrastructure/cache/cache.module';
import { EventsModule } from './events/events.module';
import { BetslipModule } from './betslip/betslip.module';
import { AuthModule } from './auth/auth.module';
import { BalanceModule } from './balance/balance.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        ...(process.env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
      },
    }),
    PrismaModule,
    CacheModule,
    EventsModule,
    BetslipModule,
    AuthModule,
    BalanceModule,
    NotificationsModule,
  ],
})
export class AppModule {}
