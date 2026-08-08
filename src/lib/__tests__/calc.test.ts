import { computeLine, computeDocumentTotals, dollarsToCents, centsToDollars, CalculationError } from '../calc';

describe('computeLine — assignment sample document', () => {
  it('Widget A: qty 2, $100.00, 10% discount, 5% tax', () => {
    const line = computeLine({
      quantity: 2,
      unitPriceCents: dollarsToCents(100.0),
      discount: { type: 'percent', value: 10 },
      taxPercent: 5,
    });
    expect(line.subtotalCents).toBe(20000);
    expect(line.discountAmountCents).toBe(2000);
    expect(line.afterDiscountCents).toBe(18000);
    expect(line.taxAmountCents).toBe(900);
    expect(line.lineTotalCents).toBe(18900);
  });

  it('Widget B: qty 1, $50.00, no discount, 5% tax', () => {
    const line = computeLine({
      quantity: 1,
      unitPriceCents: dollarsToCents(50.0),
      discount: null,
      taxPercent: 5,
    });
    expect(line.subtotalCents).toBe(5000);
    expect(line.discountAmountCents).toBe(0);
    expect(line.afterDiscountCents).toBe(5000);
    expect(line.taxAmountCents).toBe(250);
    expect(line.lineTotalCents).toBe(5250);
  });

  it('Service fee: qty 1, $200.00, $20 fixed discount, no tax', () => {
    const line = computeLine({
      quantity: 1,
      unitPriceCents: dollarsToCents(200.0),
      discount: { type: 'fixed', value: dollarsToCents(20.0) },
      taxPercent: 0,
    });
    expect(line.subtotalCents).toBe(20000);
    expect(line.discountAmountCents).toBe(2000);
    expect(line.afterDiscountCents).toBe(18000);
    expect(line.taxAmountCents).toBe(0);
    expect(line.lineTotalCents).toBe(18000);
  });

  it('document totals match the assignment sample exactly', () => {
    const lines = [
      computeLine({ quantity: 2, unitPriceCents: dollarsToCents(100.0), discount: { type: 'percent', value: 10 }, taxPercent: 5 }),
      computeLine({ quantity: 1, unitPriceCents: dollarsToCents(50.0), discount: null, taxPercent: 5 }),
      computeLine({ quantity: 1, unitPriceCents: dollarsToCents(200.0), discount: { type: 'fixed', value: dollarsToCents(20.0) }, taxPercent: 0 }),
    ];
    const totals = computeDocumentTotals(lines);
    expect(centsToDollars(totals.subtotalCents)).toBe(450.0);
    expect(centsToDollars(totals.totalDiscountCents)).toBe(40.0);
    expect(centsToDollars(totals.totalTaxCents)).toBe(11.5);
    expect(centsToDollars(totals.grandTotalCents)).toBe(421.5);
    // grand total must reconcile both ways: sum-of-line-totals and subtotal - discount + tax
    expect(totals.grandTotalCents).toBe(totals.subtotalCents - totals.totalDiscountCents + totals.totalTaxCents);
  });
});

describe('computeLine — edge cases', () => {
  it('rejects quantity below 1', () => {
    expect(() => computeLine({ quantity: 0, unitPriceCents: 100, discount: null, taxPercent: 0 })).toThrow(CalculationError);
  });

  it('rejects negative unit price', () => {
    expect(() => computeLine({ quantity: 1, unitPriceCents: -100, discount: null, taxPercent: 0 })).toThrow(CalculationError);
  });

  it('rejects negative tax percent', () => {
    expect(() => computeLine({ quantity: 1, unitPriceCents: 100, discount: null, taxPercent: -1 })).toThrow(CalculationError);
  });

  it('rejects a discount percent over 100', () => {
    expect(() =>
      computeLine({ quantity: 1, unitPriceCents: 1000, discount: { type: 'percent', value: 150 }, taxPercent: 0 })
    ).toThrow(CalculationError);
  });

  it('clamps a fixed discount that exceeds the line subtotal, floors the line at 0', () => {
    const line = computeLine({
      quantity: 1,
      unitPriceCents: dollarsToCents(10.0),
      discount: { type: 'fixed', value: dollarsToCents(50.0) },
      taxPercent: 10,
    });
    expect(line.subtotalCents).toBe(1000);
    expect(line.discountAmountCents).toBe(1000); // clamped, not 5000
    expect(line.afterDiscountCents).toBe(0);
    expect(line.taxAmountCents).toBe(0);
    expect(line.lineTotalCents).toBe(0);
  });

  it('a percent discount of 0 and tax of 0 leaves the line unchanged', () => {
    const line = computeLine({
      quantity: 3,
      unitPriceCents: dollarsToCents(19.99),
      discount: { type: 'percent', value: 0 },
      taxPercent: 0,
    });
    expect(line.subtotalCents).toBe(5997);
    expect(line.lineTotalCents).toBe(5997);
  });

  it('handles fractional quantities without floating-point drift', () => {
    // 2.5 hours at $19.99/hr, 7.5% tax — a case prone to binary float rounding error.
    const line = computeLine({
      quantity: 2.5,
      unitPriceCents: dollarsToCents(19.99),
      discount: null,
      taxPercent: 7.5,
    });
    expect(line.subtotalCents).toBe(4998); // 49.975 -> round half up -> 49.98 -> 4998
    expect(line.taxAmountCents).toBe(375); // 7.5% of 49.98 = 3.7485 -> 375 cents (3.75)
  });
});

describe('dollarsToCents / centsToDollars', () => {
  it('round-trips common money values', () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0.1)).toBe(10);
    expect(centsToDollars(1999)).toBe(19.99);
  });
});
