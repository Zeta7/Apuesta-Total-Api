import { DeleteMessageCommand, ReceiveMessageCommand, type Message } from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';
import { SqsClient } from './sqs.client';

type BetJob = { betId: string; userId: string; status: string; requestId?: string };
type QueueMessage = { id: string; type: string; payload: BetJob };

@Injectable()
export class QueueConsumers implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueConsumers.name);
  private running = true;
  private loops: Promise<void>[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sqs: SqsClient,
  ) {}

  onModuleInit(): void {
    this.loops = [
      this.poll(this.sqs.auditQueueUrl, (job, id) => this.audit(job, id)),
      this.poll(this.sqs.notificationQueueUrl, (job, id) => this.notify(job, id)),
    ];
  }

  private async poll(
    queueUrl: string,
    handler: (job: BetJob, eventId: string) => Promise<void>,
  ): Promise<void> {
    const waitTime = this.config.get<number>('SQS_WAIT_TIME_SECONDS', 10);
    const visibilityTimeout = this.config.get<number>('SQS_VISIBILITY_TIMEOUT_SECONDS', 30);
    while (this.running) {
      try {
        const response = await this.sqs.client.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: waitTime,
            VisibilityTimeout: visibilityTimeout,
          }),
        );
        await Promise.all(
          (response.Messages ?? []).map((message) => this.process(queueUrl, message, handler)),
        );
      } catch (error) {
        if (!this.running) return;
        const message = error instanceof Error ? error.message : 'Unknown SQS receive error';
        this.logger.error({ queueUrl, error: message }, 'SQS receive failed');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async process(
    queueUrl: string,
    message: Message,
    handler: (job: BetJob, eventId: string) => Promise<void>,
  ): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) return;
    try {
      const envelope = JSON.parse(message.Body) as QueueMessage;
      await handler(envelope.payload, envelope.id);
      await this.sqs.client.send(
        new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown SQS processing error';
      this.logger.error({ messageId: message.MessageId, error: detail }, 'SQS message failed');
      // SQS retries it after the visibility timeout and eventually moves it to the DLQ.
    }
  }

  private async audit(job: BetJob, eventId: string): Promise<void> {
    await this.prisma.auditEvent.upsert({
      where: { externalKey: eventId },
      create: {
        externalKey: eventId,
        type: job.status === 'ACCEPTED' ? 'BET_ACCEPTED' : 'BET_REJECTED',
        userId: job.userId,
        aggregateId: job.betId,
        requestId: job.requestId ?? null,
        payload: job,
      },
      update: {},
    });
  }

  private async notify(job: BetJob, eventId: string): Promise<void> {
    const accepted = job.status === 'ACCEPTED';
    await this.prisma.notification.upsert({
      where: { externalKey: eventId },
      create: {
        externalKey: eventId,
        userId: job.userId,
        type: accepted ? 'BET_ACCEPTED' : 'BET_REJECTED',
        title: accepted ? 'Apuesta aceptada' : 'Apuesta rechazada',
        message: accepted ? 'Tu apuesta fue confirmada.' : 'Tu apuesta no pudo ser confirmada.',
        metadata: { betId: job.betId },
      },
      update: {},
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await Promise.allSettled(this.loops);
  }
}
