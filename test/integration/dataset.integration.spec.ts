import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('dataset importado', () => {
  afterAll(async () => prisma.$disconnect());

  it('conserva los conteos validados sin duplicados', async () => {
    await expect(
      Promise.all([
        prisma.event.count(),
        prisma.team.count(),
        prisma.market.count(),
        prisma.selection.count(),
      ]),
    ).resolves.toEqual([24, 39, 191, 1257]);
  });

  it('acepta eventos sin mercados y cuotas no apostables', async () => {
    await expect(
      Promise.all([
        prisma.event.count({ where: { markets: { none: {} } } }),
        prisma.selection.count({ where: { decimalOdds: { lte: 1 } } }),
        prisma.selection.count({ where: { isDisabled: true } }),
      ]),
    ).resolves.toEqual([1, 17, 19]);
  });
});
