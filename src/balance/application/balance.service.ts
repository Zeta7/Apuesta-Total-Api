import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain/domain.error';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}
  async get(userId: string): Promise<unknown> {
    const balance = await this.prisma.balance.findUnique({ where: { userId } });
    if (!balance) throw new DomainError('BALANCE_NOT_FOUND', 'Balance no encontrado', 404);
    return {
      currency: balance.currency,
      available: balance.amount.toFixed(2),
      bonus: balance.bonus.toFixed(2),
      updatedAt: balance.updatedAt.toISOString(),
    };
  }
}
