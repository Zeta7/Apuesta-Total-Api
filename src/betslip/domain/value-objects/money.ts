import Decimal from 'decimal.js';
import { DomainError } from '../../../common/domain/domain.error';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export class Money {
  private constructor(
    readonly value: Decimal,
    readonly currency: string,
  ) {}
  static create(value: string, currency = 'PEN'): Money {
    let amount: Decimal;
    try {
      amount = new Decimal(value);
    } catch {
      throw new DomainError('INVALID_STAKE', 'El monto no es válido');
    }
    if (!amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 2)
      throw new DomainError('INVALID_STAKE', 'El monto no es válido');
    return new Money(amount, currency);
  }
  multiply(multiplier: Decimal): Money {
    return new Money(
      this.value.mul(multiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      this.currency,
    );
  }
  toString(): string {
    return this.value.toFixed(2);
  }
}
