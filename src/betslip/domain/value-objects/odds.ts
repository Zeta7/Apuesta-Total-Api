import Decimal from 'decimal.js';
import { DomainError } from '../../../common/domain/domain.error';

export class Odds {
  private constructor(readonly value: Decimal) {}
  static create(value: string): Odds {
    let odds: Decimal;
    try {
      odds = new Decimal(value);
    } catch {
      throw new DomainError('SELECTION_UNAVAILABLE', 'La cuota no es válida');
    }
    if (!odds.isFinite() || odds.lte(1))
      throw new DomainError('SELECTION_UNAVAILABLE', 'La cuota no está disponible');
    return new Odds(odds);
  }
  multiply(other: Odds): Odds {
    return new Odds(this.value.mul(other.value));
  }
  toString(): string {
    return this.value.toDecimalPlaces(6).toFixed();
  }
}
