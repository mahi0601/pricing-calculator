import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { PricingDocument } from '@/lib/models/Document';
import { recomputeTotals, serializeDocument } from '@/lib/documents';
import { loadOwnedDocument } from '@/lib/loadOwnedDocument';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  await connectToDatabase();
  const { id } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status !== 'finalized') {
    return errorResponse(400, 'Only finalized documents can be duplicated');
  }

  // Assumption (documented in README): the copy is a fresh draft, so its
  // issue date resets to today rather than carrying over the original's —
  // the original already represents what was issued on that date.
  const copy = new PricingDocument({
    userId,
    title: `${doc.title} (Copy)`,
    customer: doc.customer,
    issueDate: new Date(),
    status: 'draft',
    lineItems: doc.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxPercent: line.taxPercent,
      subtotalCents: line.subtotalCents,
      discountAmountCents: line.discountAmountCents,
      afterDiscountCents: line.afterDiscountCents,
      taxAmountCents: line.taxAmountCents,
      lineTotalCents: line.lineTotalCents,
    })),
  });
  recomputeTotals(copy);
  await copy.save();

  return NextResponse.json(serializeDocument(copy), { status: 201 });
}
