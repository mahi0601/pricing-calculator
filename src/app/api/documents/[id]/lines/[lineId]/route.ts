import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineItems } from '@/lib/schema';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { lineItemUpdateSchema } from '@/lib/validation';
import { buildLineItem, lineToApiInput, recomputeTotals, serializeDocument } from '@/lib/documents';
import { getLineItems, isValidUuid, loadOwnedDocument, persistTotals } from '@/lib/documentQueries';
import { CalculationError } from '@/lib/calc';

type Params = { params: Promise<{ id: string; lineId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const parsed = await parseJson(request, lineItemUpdateSchema);
  if (parsed.error) return parsed.error;

  const db = getDb();
  const { id, lineId } = await params;
  const doc = await loadOwnedDocument(db, userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; lines can no longer be edited');
  }

  if (!isValidUuid(lineId)) return errorResponse(404, 'Line item not found');

  const [current] = await db
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.id, lineId), eq(lineItems.documentId, doc.id)));
  if (!current) return errorResponse(404, 'Line item not found');

  const merged = { ...lineToApiInput(current), ...parsed.data };

  let built;
  try {
    built = buildLineItem(merged);
  } catch (err) {
    if (err instanceof CalculationError) return errorResponse(400, err.message);
    throw err;
  }

  const { doc: updatedDoc, lines } = await db.transaction(async (tx) => {
    await tx.update(lineItems).set(built).where(eq(lineItems.id, lineId));
    const allLines = await getLineItems(tx, doc.id);
    const totals = recomputeTotals(allLines);
    const updatedDoc = await persistTotals(tx, doc.id, totals);
    return { doc: updatedDoc, lines: allLines };
  });

  return NextResponse.json(serializeDocument(updatedDoc, lines));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const db = getDb();
  const { id, lineId } = await params;
  const doc = await loadOwnedDocument(db, userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; lines can no longer be removed');
  }

  if (!isValidUuid(lineId)) return errorResponse(404, 'Line item not found');

  const [existing] = await db
    .select({ id: lineItems.id })
    .from(lineItems)
    .where(and(eq(lineItems.id, lineId), eq(lineItems.documentId, doc.id)));
  if (!existing) return errorResponse(404, 'Line item not found');

  const { doc: updatedDoc, lines } = await db.transaction(async (tx) => {
    await tx.delete(lineItems).where(eq(lineItems.id, lineId));
    const allLines = await getLineItems(tx, doc.id);
    const totals = recomputeTotals(allLines);
    const updatedDoc = await persistTotals(tx, doc.id, totals);
    return { doc: updatedDoc, lines: allLines };
  });

  return NextResponse.json(serializeDocument(updatedDoc, lines));
}
