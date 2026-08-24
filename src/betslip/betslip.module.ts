import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/http/rate-limit.guard';
import { AuthModule } from '../auth/auth.module';
import { CalculateBetslipService } from './application/calculate-betslip.service';
import { PlaceBetslipService } from './application/place-betslip.service';
import { SELECTION_RESOLVER } from './application/selection-resolver.port';
import { PrismaSelectionResolver } from './infrastructure/prisma-selection.resolver';
import { BetslipController } from './presentation/betslip.controller';

@Module({
  imports: [AuthModule],
  controllers: [BetslipController],
  providers: [
    CalculateBetslipService,
    PlaceBetslipService,
    RateLimitGuard,
    { provide: SELECTION_RESOLVER, useClass: PrismaSelectionResolver },
  ],
})
export class BetslipModule {}
