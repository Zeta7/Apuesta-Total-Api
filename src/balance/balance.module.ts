import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BalanceService } from './application/balance.service';
import { BalanceController } from './presentation/balance.controller';

@Module({ imports: [AuthModule], controllers: [BalanceController], providers: [BalanceService] })
export class BalanceModule {}
