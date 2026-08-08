/**
 * Pricing calculation module.
 *
 * Rounding policy: round-half-up to the nearest cent, applied once at each
 * computed step (subtotal, discount amount, tax amount). Line total and
 * document totals are then exact sums of already-rounded cent values, so no
 * further rounding is ever needed downstream. See README for a worked example.
 *
 * All money is handled as integer cents throughout — never as a float dollar
 * amount — to avoid floating-point drift. Conversion to/from dollars happens
 * only at the API boundary (dollarsToCents / centsToDollars).
 */

export class CalculationError extends Error {}

export type Discount = { type: 'fixed'; value: number } | { type: 'percent'; value: number } | null;

export interface LineItemInput {
  quantity: number;
  unitPriceCents: number;
  discount: Discount;
  taxPercent: number;
}

export interface LineItemComputed {
  subtotalCents: number;
  discountAmountCents: number;
  afterDiscountCents: number;
  taxAmountCents: number;
  lineTotalCents: number;
}

export interface DocumentTotals {
  subtotalCents: number;
  totalDiscountCents: number;
  totalTaxCents: number;
  grandTotalCents: number;
}

// Nudges values that land exactly on a .5 cent boundary but are represented
// as e.g. 179.9999999999998 due to binary floating-point, before rounding.
function roundCents(value: number): number {
  return Math.round(value + 1e-9);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100 + 1e-9 * Math.sign(dollars));
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function computeLine(input: LineItemInput): LineItemComputed {
  const { quantity, unitPriceCents, discount, taxPercent } = input;

  if (!(quantity >= 1)) {
    throw new CalculationError('Quantity must be at least 1');
  }
  if (!(unitPriceCents >= 0)) {
    throw new CalculationError('Unit price must be non-negative');
  }
  if (!(taxPercent >= 0)) {
    throw new CalculationError('Tax percent must be non-negative');
  }

  const subtotalCents = roundCents(quantity * unitPriceCents);

  let discountAmountCents = 0;
  if (discount) {
    if (discount.type === 'percent') {
      if (!(discount.value >= 0) || discount.value > 100) {
        throw new CalculationError('Discount percent must be between 0 and 100');
      }
      discountAmountCents = roundCents(subtotalCents * (discount.value / 100));
    } else if (discount.type === 'fixed') {
      if (!(discount.value >= 0)) {
        throw new CalculationError('Fixed discount must be non-negative');
      }
      // Policy: a fixed discount that exceeds the line's own subtotal is
      // clamped to the subtotal (line floors at 0) rather than rejected.
      discountAmountCents = Math.min(discount.value, subtotalCents);
    } else {
      throw new CalculationError(`Unknown discount type: ${(discount as { type: string }).type}`);
    }
  }

  const afterDiscountCents = subtotalCents - discountAmountCents;
  const taxAmountCents = roundCents(afterDiscountCents * (taxPercent / 100));
  const lineTotalCents = afterDiscountCents + taxAmountCents;

  return { subtotalCents, discountAmountCents, afterDiscountCents, taxAmountCents, lineTotalCents };
}

export function computeDocumentTotals(lines: LineItemComputed[]): DocumentTotals {
  return lines.reduce<DocumentTotals>(
    (acc, l) => ({
      subtotalCents: acc.subtotalCents + l.subtotalCents,
      totalDiscountCents: acc.totalDiscountCents + l.discountAmountCents,
      totalTaxCents: acc.totalTaxCents + l.taxAmountCents,
      grandTotalCents: acc.grandTotalCents + l.lineTotalCents,
    }),
    { subtotalCents: 0, totalDiscountCents: 0, totalTaxCents: 0, grandTotalCents: 0 }
  );
}
