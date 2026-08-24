import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetslipCalculator } from '../domain/betslip-calculator';
import { SELECTION_RESOLVER, type SelectionResolver } from './selection-resolver.port';

export type CalculateCommand = { type: 'SINGLE' | 'COMBO'; stake: string; selectionIds: string[] };
@Injectable()
export class CalculateBetslipService {
  private readonly calculator = new BetslipCalculator();
  constructor(
    @Inject(SELECTION_RESOLVER) private readonly resolver: SelectionResolver,
    private readonly config: ConfigService,
  ) {}
  async execute(command: CalculateCommand): Promise<unknown> {
    const selections = await this.resolver.resolve(command.selectionIds);
    const minStake = this.config.get<string>('MIN_STAKE', '1.00');
    const maxStake = this.config.get<string>('MAX_STAKE', '1000.00');
    const currency = this.config.get<string>('DEFAULT_CURRENCY', 'PEN');
    const calculation = this.calculator.calculate({
      ...command,
      selections,
      minStake,
      maxStake,
      currency,
    });
    return { selections, bets: [calculation], minStake, maxStake, currency };
  }
}
