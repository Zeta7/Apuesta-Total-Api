import { DomainError } from '../../common/domain/domain.error';
import { Money } from './value-objects/money';
import { Odds } from './value-objects/odds';

export type ResolvedSelection = { id: string; eventId: string; odds: string; available: boolean };
export type BetslipCalculationInput = {
  type: 'SINGLE' | 'COMBO';
  stake: string;
  selections: ResolvedSelection[];
  minStake: string;
  maxStake: string;
  currency?: string;
};

export class BetslipCalculator {
  calculate(input: BetslipCalculationInput): {
    type: 'SINGLE' | 'COMBO';
    stake: string;
    combinedOdds: string;
    potentialReturns: string;
  } {
    const stake = Money.create(input.stake, input.currency ?? 'PEN');
    const min = Money.create(input.minStake, stake.currency);
    const max = Money.create(input.maxStake, stake.currency);
    if (stake.value.lt(min.value))
      throw new DomainError('STAKE_BELOW_MINIMUM', 'El monto es menor al mínimo');
    if (stake.value.gt(max.value))
      throw new DomainError('STAKE_ABOVE_MAXIMUM', 'El monto supera el máximo');
    const expected = input.type === 'SINGLE' ? 1 : 2;
    if (
      input.selections.length < expected ||
      (input.type === 'SINGLE' && input.selections.length !== 1)
    )
      throw new DomainError(
        'INVALID_BET_TYPE',
        'La cantidad de selecciones no corresponde al tipo',
      );
    const unavailable = input.selections.find((selection) => !selection.available);
    if (unavailable)
      throw new DomainError('SELECTION_UNAVAILABLE', 'La selección no está disponible', 422, {
        selectionId: unavailable.id,
      });
    if (input.type === 'COMBO') {
      const eventIds = new Set(input.selections.map((selection) => selection.eventId));
      if (eventIds.size !== input.selections.length)
        throw new DomainError(
          'SAME_EVENT_SELECTIONS',
          'No se pueden combinar selecciones del mismo evento',
        );
    }
    const combined = input.selections
      .map((selection) => Odds.create(selection.odds))
      .reduce((left, right) => left.multiply(right));
    return {
      type: input.type,
      stake: stake.toString(),
      combinedOdds: combined.toString(),
      potentialReturns: stake.multiply(combined.value).toString(),
    };
  }
}
