import { computeLine, computeDocumentTotals, dollarsToCents, centsToDollars } from './calc';
import type { DocumentRow, LineItemRow, NewLineItemRow } from './schema';

export interface LineItemApiInput {
  description: string;
  quantity: number;
  unitPrice: number; // dollars
  discount?: { type: 'fixed' | 'percent'; value: number } | null;
  taxPercent?: number;
}

type BuiltLineItem = Omit<NewLineItemRow, 'id' | 'documentId' | 'position'>;

/** Builds a fully-computed line item (in storage shape) from API input, in dollars. */
export function buildLineItem(input: LineItemApiInput): BuiltLineItem {
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

/** Inverse of buildLineItem: reconstructs API-shaped (dollar) input from a stored line, used to merge partial PATCH updates before recomputing. */
export function lineToApiInput(line: LineItemRow): LineItemApiInput {
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

export function recomputeTotals(lines: Pick<LineItemRow, 'subtotalCents' | 'discountAmountCents' | 'afterDiscountCents' | 'taxAmountCents' | 'lineTotalCents'>[]) {
  return computeDocumentTotals(lines);
}

export function serializeLineItem(line: LineItemRow) {
  return {
    id: line.id,
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

/** List-view shape: omits line items, which the documents list never renders — avoids an N+1 (or bulk IN) query per page of results. */
export function serializeDocumentSummary(doc: DocumentRow) {
  return {
    id: doc.id,
    title: doc.title,
    customer: doc.customer,
    issueDate: doc.issueDate.toISOString(),
    status: doc.status,
    finalizedAt: doc.finalizedAt ? doc.finalizedAt.toISOString() : null,
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

export function serializeDocument(doc: DocumentRow, lines: LineItemRow[]) {
  return {
    id: doc.id,
    title: doc.title,
    customer: doc.customer,
    issueDate: doc.issueDate.toISOString(),
    status: doc.status,
    finalizedAt: doc.finalizedAt ? doc.finalizedAt.toISOString() : null,
    lineItems: [...lines].sort((a, b) => a.position - b.position).map(serializeLineItem),
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
