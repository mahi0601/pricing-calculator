import { computeLine, computeDocumentTotals, dollarsToCents, centsToDollars } from './calc';
import type { DocumentDoc, LineItemDoc } from './models/Document';

export interface LineItemApiInput {
  description: string;
  quantity: number;
  unitPrice: number; // dollars
  discount?: { type: 'fixed' | 'percent'; value: number } | null;
  taxPercent?: number;
}

/** Builds a fully-computed line item (in storage shape) from API input, in dollars. */
export function buildLineItem(input: LineItemApiInput) {
  const unitPriceCents = dollarsToCents(input.unitPrice);
  const discount = input.discount
    ? input.discount.type === 'fixed'
      ? { type: 'fixed' as const, value: dollarsToCents(input.discount.value) }
      : { type: 'percent' as const, value: input.discount.value }
    : null;
  const taxPercent = input.taxPercent ?? 0;

  const computed = computeLine({ quantity: input.quantity, unitPriceCents, discount, taxPercent });

  return {
    description: input.description,
    quantity: input.quantity,
    unitPriceCents,
    discountType: discount?.type ?? null,
    discountValue: discount?.value ?? null,
    taxPercent,
    ...computed,
  };
}

/** Recomputes and writes the cached document-level totals from its line items. In place — call after any line item mutation, before save(). */
export function recomputeTotals(doc: Pick<DocumentDoc, 'lineItems' | 'subtotalCents' | 'totalDiscountCents' | 'totalTaxCents' | 'grandTotalCents'>) {
  const totals = computeDocumentTotals(doc.lineItems);
  doc.subtotalCents = totals.subtotalCents;
  doc.totalDiscountCents = totals.totalDiscountCents;
  doc.totalTaxCents = totals.totalTaxCents;
  doc.grandTotalCents = totals.grandTotalCents;
}

/** Inverse of buildLineItem: reconstructs API-shaped (dollar) input from a stored line, used to merge partial PATCH updates before recomputing. */
export function lineToApiInput(line: LineItemDoc): LineItemApiInput {
  return {
    description: line.description,
    quantity: line.quantity,
    unitPrice: centsToDollars(line.unitPriceCents),
    discount: line.discountType
      ? {
          type: line.discountType,
          value: line.discountType === 'fixed' ? centsToDollars(line.discountValue ?? 0) : (line.discountValue ?? 0),
        }
      : null,
    taxPercent: line.taxPercent,
  };
}

export function serializeLineItem(line: LineItemDoc) {
  return {
    id: line._id.toString(),
    description: line.description,
    quantity: line.quantity,
    unitPrice: centsToDollars(line.unitPriceCents),
    discount: line.discountType
      ? {
          type: line.discountType,
          value: line.discountType === 'fixed' ? centsToDollars(line.discountValue ?? 0) : (line.discountValue ?? 0),
        }
      : null,
    taxPercent: line.taxPercent,
    subtotal: centsToDollars(line.subtotalCents),
    discountAmount: centsToDollars(line.discountAmountCents),
    afterDiscount: centsToDollars(line.afterDiscountCents),
    taxAmount: centsToDollars(line.taxAmountCents),
    lineTotal: centsToDollars(line.lineTotalCents),
  };
}

export function serializeDocument(doc: DocumentDoc) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    customer: doc.customer,
    issueDate: doc.issueDate.toISOString(),
    status: doc.status,
    finalizedAt: doc.finalizedAt ? doc.finalizedAt.toISOString() : null,
    lineItems: doc.lineItems.map(serializeLineItem),
    totals: {
      subtotal: centsToDollars(doc.subtotalCents),
      totalDiscount: centsToDollars(doc.totalDiscountCents),
      totalTax: centsToDollars(doc.totalTaxCents),
      grandTotal: centsToDollars(doc.grandTotalCents),
    },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
