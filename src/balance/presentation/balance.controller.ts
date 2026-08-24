import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/domain/auth-user';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { JwtAuthGuard } from '../../auth/presentation/jwt-auth.guard';
import { BalanceService } from '../application/balance.service';

@ApiTags('balance')
@ApiBearerAuth()
@Controller('balance')
@UseGuards(JwtAuthGuard)
export class BalanceController {
  constructor(private readonly balances: BalanceService) {}
  @Get() get(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.balances.get(user.id);
  }
}
