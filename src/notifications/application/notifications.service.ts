import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain/domain.error';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string): Promise<unknown> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        metadata: row.metadata,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
  async markRead(userId: string, id: string): Promise<unknown> {
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1)
      throw new DomainError('NOTIFICATION_NOT_FOUND', 'Notificación no encontrada', 404);
    return { id, read: true };
  }
}
