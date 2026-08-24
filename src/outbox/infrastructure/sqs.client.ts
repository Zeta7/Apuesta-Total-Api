import { SQSClient as AwsSqsClient } from '@aws-sdk/client-sqs';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SqsClient implements OnModuleDestroy {
  readonly client: AwsSqsClient;
  readonly auditQueueUrl: string;
  readonly notificationQueueUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('AWS_SQS_ENDPOINT');
    this.client = new AwsSqsClient({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
      ...(endpoint ? { endpoint } : {}),
    });
    this.auditQueueUrl = config.getOrThrow<string>('SQS_AUDIT_QUEUE_URL');
    this.notificationQueueUrl = config.getOrThrow<string>('SQS_NOTIFICATION_QUEUE_URL');
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
