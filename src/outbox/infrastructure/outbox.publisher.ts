import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OutboxEvent } from '@prisma/client';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';
import { SqsClient } from './sqs.client';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private publishing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sqs: SqsClient,
  ) {}

  onModuleInit(): void {
    const interval = this.config.get<number>('OUTBOX_POLL_INTERVAL_MS', 2000);
    this.timer = setInterval(() => void this.publishBatch(), interval);
    void this.publishBatch();
  }

  async publishBatch(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const batchSize = this.config.get<number>('OUTBOX_BATCH_SIZE', 50);
      const timeout = this.config.get<number>('OUTBOX_PROCESSING_TIMEOUT_MS', 60000);
      const events = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "OutboxEvent" SET status = 'PENDING', "processingAt" = NULL WHERE status = 'PROCESSING' AND "processingAt" < NOW() - (${timeout} * INTERVAL '1 millisecond')`;
        return tx.$queryRaw<
          OutboxEvent[]
        >`WITH claimed AS (SELECT id FROM "OutboxEvent" WHERE status = 'PENDING' ORDER BY "occurredAt" FOR UPDATE SKIP LOCKED LIMIT ${batchSize}) UPDATE "OutboxEvent" o SET status = 'PROCESSING', "processingAt" = NOW(), attempts = attempts + 1 FROM claimed WHERE o.id = claimed.id RETURNING o.*`;
      });

      for (const event of events) {
        try {
          const queueUrl =
            event.type === 'BET_AUDIT_REQUESTED'
              ? this.sqs.auditQueueUrl
              : this.sqs.notificationQueueUrl;
          await this.sqs.client.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify({ id: event.id, type: event.type, payload: event.payload }),
              MessageAttributes: {
                eventType: { DataType: 'String', StringValue: event.type },
              },
            }),
          );
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'PUBLISHED', publishedAt: new Date(), lastError: null },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown publish error';
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'PENDING', processingAt: null, lastError: message },
          });
          this.logger.error({ outboxEventId: event.id, error: message }, 'Outbox publish failed');
        }
      }
    } finally {
      this.publishing = false;
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
