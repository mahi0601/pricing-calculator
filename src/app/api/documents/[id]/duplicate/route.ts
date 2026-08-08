import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { documents, lineItems } from '@/lib/schema';
import { getUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { serializeDocument } from '@/lib/documents';
import { getLineItems, loadOwnedDocument } from '@/lib/documentQueries';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const db = getDb();
  const { id } = await params;
  const doc = await loadOwnedDocument(db, userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status !== 'finalized') {
    return errorResponse(400, 'Only finalized documents can be duplicated');
  }

  const originalLines = await getLineItems(db, doc.id);

  const { doc: copy, lines: copiedLines } = await db.transaction(async (tx) => {
    // Assumption (documented in README): the copy is a fresh draft, so its
    // issue date resets to today rather than carrying over the original's —
    // the original already represents what was issued on that date.
    const [copy] = await tx
      .insert(documents)
      .values({
        userId,
        title: `${doc.title} (Copy)`,
        customer: doc.customer,
        issueDate: new Date(),
        status: 'draft',
        subtotalCents: doc.subtotalCents,
        totalDiscountCents: doc.totalDiscountCents,
        totalTaxCents: doc.totalTaxCents,
        grandTotalCents: doc.grandTotalCents,
      })
      .returning();

    const copiedLines = originalLines.length
      ? await tx
          .insert(lineItems)
          .values(
            originalLines.map((line) => ({
              documentId: copy.id,
              position: line.position,
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
            }))
          )
          .returning()
      : [];

    return { doc: copy, lines: copiedLines };
  });

  return NextResponse.json(serializeDocument(copy, copiedLines), { status: 201 });
}
