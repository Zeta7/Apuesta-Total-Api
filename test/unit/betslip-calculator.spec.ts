import { DomainError } from '../../src/common/domain/domain.error';
import {
  BetslipCalculator,
  type BetslipCalculationInput,
} from '../../src/betslip/domain/betslip-calculator';

const calculator = new BetslipCalculator();
const base: BetslipCalculationInput = {
  type: 'SINGLE',
  stake: '10.00',
  minStake: '1.00',
  maxStake: '1000.00',
  selections: [{ id: 'one', eventId: 'event-1', odds: '1.45', available: true }],
};
describe('BetslipCalculator', () => {
  it('calcula una apuesta simple', () =>
    expect(calculator.calculate(base)).toEqual({
      type: 'SINGLE',
      stake: '10.00',
      combinedOdds: '1.45',
      potentialReturns: '14.50',
    }));
  it('multiplica cuotas de un combo', () =>
    expect(
      calculator.calculate({
        ...base,
        type: 'COMBO',
        stake: '20',
        selections: [
          ...base.selections,
          { id: 'two', eventId: 'event-2', odds: '2.00', available: true },
        ],
      }),
    ).toMatchObject({ combinedOdds: '2.9', potentialReturns: '58.00' }));
  it('rechaza selecciones del mismo evento', () =>
    expect(() =>
      calculator.calculate({
        ...base,
        type: 'COMBO',
        selections: [
          ...base.selections,
          { id: 'two', eventId: 'event-1', odds: '2', available: true },
        ],
      }),
    ).toThrow(expect.objectContaining({ code: 'SAME_EVENT_SELECTIONS' }) as DomainError));
  it.each([
    ['0.99', 'STAKE_BELOW_MINIMUM'],
    ['1000.01', 'STAKE_ABOVE_MAXIMUM'],
  ])('valida límite %s', (stake, code) =>
    expect(() => calculator.calculate({ ...base, stake })).toThrow(
      expect.objectContaining({ code }) as DomainError,
    ),
  );
  it('redondea half-up a dos decimales', () =>
    expect(
      calculator.calculate({
        ...base,
        stake: '1.01',
        selections: [{ ...base.selections[0]!, odds: '1.005' }],
      }).potentialReturns,
    ).toBe('1.02'));
  it('rechaza selección inactiva', () =>
    expect(() =>
      calculator.calculate({ ...base, selections: [{ ...base.selections[0]!, available: false }] }),
    ).toThrow(expect.objectContaining({ code: 'SELECTION_UNAVAILABLE' }) as DomainError));
  it('rechaza cuota cero', () =>
    expect(() =>
      calculator.calculate({ ...base, selections: [{ ...base.selections[0]!, odds: '0' }] }),
    ).toThrow(expect.objectContaining({ code: 'SELECTION_UNAVAILABLE' }) as DomainError));
});
