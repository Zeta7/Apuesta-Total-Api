import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from '../common/infrastructure/prisma/prisma.module';
import { validateEnvironment } from '../config/environment';
import { OutboxPublisher } from './infrastructure/outbox.publisher';
import { QueueConsumers } from './infrastructure/queue.consumers';
import { SqsClient } from './infrastructure/sqs.client';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot(),
    PrismaModule,
  ],
  providers: [SqsClient, OutboxPublisher, QueueConsumers],
})
export class WorkerModule {}
