import type { ResolvedSelection } from '../domain/betslip-calculator';

export const SELECTION_RESOLVER = Symbol('SELECTION_RESOLVER');
export interface SelectionResolver {
  resolve(ids: string[]): Promise<ResolvedSelection[]>;
}
