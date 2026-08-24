import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DomainError } from '../../common/domain/domain.error';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';
import { BetslipCalculator, type ResolvedSelection } from '../domain/betslip-calculator';
import type { CalculateCommand } from './calculate-betslip.service';

@Injectable()
export class PlaceBetslipService {
  private readonly calculator = new BetslipCalculator();
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    userId: string,
    idempotencyKey: string | undefined,
    command: CalculateCommand,
    requestId: string,
  ): Promise<unknown> {
    if (!idempotencyKey)
      throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key es obligatorio', 400);
    const payloadHash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
    const existing = await this.prisma.bet.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { selections: true },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new DomainError(
          'IDEMPOTENCY_CONFLICT',
          'La llave ya fue usada con otro payload',
          409,
        );
      if (existing.status === 'REJECTED')
        throw new DomainError(existing.rejectionCode ?? 'BET_REJECTED', 'La apuesta fue rechazada');
      return this.mapBet(existing);
    }
    const outcome = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.selection.findMany({
        where: { id: { in: command.selectionIds } },
        include: {
          market: { include: { event: { include: { homeTeam: true, awayTeam: true } } } },
        },
      });
      if (rows.length !== command.selectionIds.length)
        throw new DomainError('SELECTION_NOT_FOUND', 'Una selección no existe', 404);
      const byId = new Map(rows.map((row) => [row.id, row]));
      const selections: ResolvedSelection[] = command.selectionIds.map((id) => {
        const row = byId.get(id)!;
        return {
          id,
          eventId: row.market.eventId,
          odds: row.decimalOdds.toFixed(),
          available:
            !row.isDisabled &&
            row.status === '0' &&
            row.decimalOdds.gt(1) &&
            !row.market.isSuspended &&
            !row.market.event.isSuspended &&
            row.market.event.startDate > new Date(),
        };
      });
      const calculation = this.calculator.calculate({
        ...command,
        selections,
        minStake: this.config.get<string>('MIN_STAKE', '1.00'),
        maxStake: this.config.get<string>('MAX_STAKE', '1000.00'),
        currency: this.config.get<string>('DEFAULT_CURRENCY', 'PEN'),
      });
      const debited = await tx.$executeRaw(
        Prisma.sql`UPDATE "Balance" SET "amount" = "amount" - ${new Prisma.Decimal(calculation.stake)}, "updatedAt" = NOW() WHERE "userId" = ${userId}::uuid AND "amount" >= ${new Prisma.Decimal(calculation.stake)}`,
      );
      if (debited !== 1) {
        const rejected = await tx.bet.create({
          data: {
            userId,
            type: command.type,
            status: 'REJECTED',
            stake: calculation.stake,
            combinedOdds: calculation.combinedOdds,
            potentialReturns: calculation.potentialReturns,
            currency: this.config.get<string>('DEFAULT_CURRENCY', 'PEN'),
            idempotencyKey,
            payloadHash,
            rejectionCode: 'INSUFFICIENT_BALANCE',
          },
        });
        await tx.outboxEvent.create({
          data: {
            type: 'BET_NOTIFICATION_REQUESTED',
            aggregateId: rejected.id,
            occurredAt: new Date(),
            payload: { betId: rejected.id, userId, status: 'REJECTED', requestId },
          },
        });
        return { rejected: true as const };
      }
      const bet = await tx.bet.create({
        data: {
          userId,
          type: command.type,
          status: 'ACCEPTED',
          stake: calculation.stake,
          combinedOdds: calculation.combinedOdds,
          potentialReturns: calculation.potentialReturns,
          currency: this.config.get<string>('DEFAULT_CURRENCY', 'PEN'),
          idempotencyKey,
          payloadHash,
          selections: {
            create: command.selectionIds.map((id) => {
              const row = byId.get(id)!;
              return {
                selectionId: row.id,
                eventId: row.market.event.id,
                eventName: row.market.event.name,
                marketName: row.market.name,
                selectionName: row.name,
                acceptedOdds: row.decimalOdds,
                homeTeamName: row.market.event.homeTeam?.name ?? null,
                awayTeamName: row.market.event.awayTeam?.name ?? null,
                snapshotMetadata: {
                  selectionExternalId: row.externalId,
                  marketExternalId: row.market.externalId,
                },
              };
            }),
          },
        },
        include: { selections: true },
      });
      await tx.balanceMovement.create({
        data: {
          userId,
          betId: bet.id,
          type: 'DEBIT',
          amount: calculation.stake,
          currency: bet.currency,
          reference: `BET:${bet.id}`,
        },
      });
      await tx.outboxEvent.createMany({
        data: ['BET_AUDIT_REQUESTED', 'BET_NOTIFICATION_REQUESTED'].map((type) => ({
          type,
          aggregateId: bet.id,
          occurredAt: new Date(),
          payload: { betId: bet.id, userId, status: 'ACCEPTED', requestId },
        })),
      });
      return { rejected: false as const, bet };
    });
    if (outcome.rejected) throw new DomainError('INSUFFICIENT_BALANCE', 'Saldo insuficiente');
    return this.mapBet(outcome.bet);
  }

  private mapBet(bet: {
    id: string;
    status: string;
    type: string;
    stake: Prisma.Decimal;
    combinedOdds: Prisma.Decimal;
    potentialReturns: Prisma.Decimal;
    currency: string;
    selections: Array<{ selectionId: string; eventId: string; acceptedOdds: Prisma.Decimal }>;
  }): unknown {
    return {
      id: bet.id,
      status: bet.status,
      type: bet.type,
      stake: bet.stake.toFixed(2),
      combinedOdds: bet.combinedOdds.toFixed(),
      potentialReturns: bet.potentialReturns.toFixed(2),
      currency: bet.currency,
      selections: bet.selections.map((item) => ({
        selectionId: item.selectionId,
        eventId: item.eventId,
        acceptedOdds: item.acceptedOdds.toFixed(),
      })),
    };
  }
}
