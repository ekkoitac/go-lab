export type Implementation = 'buggy' | 'fixed';
export type Outcome = 'both-pass' | 'spec-fails';
export type ShippingResult = { amount: number; actual: number; copiedExpected: number; specExpected: number; copiedPass: boolean; specPass: boolean; outcome: Outcome };
// The oracle is a specification table. It does not call the implementation.
export const shippingContract = [
  { min: 0, max: 99, fee: 10, label: '未满 100' },
  { min: 100, max: 200, fee: 0, label: '满 100（含 100）' },
] as const;
export function specificationFee(amount: number): number {
  const row = shippingContract.find(rule => amount >= rule.min && amount <= rule.max);
  if (!Number.isInteger(amount) || !row) throw new RangeError('实验金额必须是 0–200 的整数');
  return row.fee;
}
export function shippingFee(amount: number, implementation: Implementation): number {
  return (implementation === 'buggy' ? amount > 100 : amount >= 100) ? 0 : 10;
}
export function inspectShipping(amount: number, implementation: Implementation): ShippingResult {
  const specExpected = specificationFee(amount);
  const actual = shippingFee(amount, implementation);
  // Deliberately reproduce the selected implementation: this is the anti-pattern being taught.
  const copiedExpected = (implementation === 'buggy' ? amount > 100 : amount >= 100) ? 0 : 10;
  const specPass = actual === specExpected;
  return { amount, actual, copiedExpected, specExpected, copiedPass: actual === copiedExpected, specPass, outcome: specPass ? 'both-pass' : 'spec-fails' };
}
export function boundaryComparison(implementation: Implementation): ShippingResult[] {
  return [99, 100, 101].map(amount => inspectShipping(amount, implementation));
}
export function couponEligible(amount: number): boolean {
  if (!Number.isInteger(amount) || amount < 0 || amount > 100) throw new RangeError('优惠券实验金额必须是 0–100 的整数');
  return amount >= 50;
}
