import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';
import type { ResolvedSelection } from '../domain/betslip-calculator';
import type { SelectionResolver } from '../application/selection-resolver.port';

@Injectable()
export class PrismaSelectionResolver implements SelectionResolver {
  constructor(private readonly prisma: PrismaService) {}
  async resolve(ids: string[]): Promise<ResolvedSelection[]> {
    const rows = await this.prisma.selection.findMany({
      where: { id: { in: ids } },
      include: { market: { include: { event: true } } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => {
      const row = byId.get(id);
      if (!row) return { id, eventId: '', odds: '0', available: false };
      const available =
        !row.isDisabled &&
        row.status === '0' &&
        row.decimalOdds.gt(1) &&
        !row.market.isSuspended &&
        !row.market.event.isSuspended &&
        row.market.event.startDate > new Date();
      return {
        id: row.id,
        eventId: row.market.eventId,
        odds: row.decimalOdds.toFixed(),
        available,
      };
    });
  }
}
