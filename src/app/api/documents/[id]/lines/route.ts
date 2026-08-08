import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { lineItems } from '@/lib/schema';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { lineItemInputSchema } from '@/lib/validation';
import { buildLineItem, recomputeTotals, serializeDocument } from '@/lib/documents';
import { getLineItems, loadOwnedDocument, persistTotals } from '@/lib/documentQueries';
import { CalculationError } from '@/lib/calc';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const parsed = await parseJson(request, lineItemInputSchema);
  if (parsed.error) return parsed.error;

  const db = getDb();
  const { id } = await params;
  const doc = await loadOwnedDocument(db, userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; lines can no longer be added');
  }

  let built;
  try {
    built = buildLineItem(parsed.data);
  } catch (err) {
    if (err instanceof CalculationError) return errorResponse(400, err.message);
    throw err;
  }

  const { doc: updatedDoc, lines } = await db.transaction(async (tx) => {
    const existing = await getLineItems(tx, doc.id);
    await tx.insert(lineItems).values({ ...built, documentId: doc.id, position: existing.length });
    const allLines = await getLineItems(tx, doc.id);
    const totals = recomputeTotals(allLines);
    const updatedDoc = await persistTotals(tx, doc.id, totals);
    return { doc: updatedDoc, lines: allLines };
  });

  return NextResponse.json(serializeDocument(updatedDoc, lines), { status: 201 });
}
