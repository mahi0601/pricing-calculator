import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { lineItemInputSchema } from '@/lib/validation';
import { buildLineItem, recomputeTotals, serializeDocument } from '@/lib/documents';
import { loadOwnedDocument } from '@/lib/loadOwnedDocument';
import { CalculationError } from '@/lib/calc';
import type { LineItemDoc } from '@/lib/models/Document';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const parsed = await parseJson(request, lineItemInputSchema);
  if (parsed.error) return parsed.error;

  await connectToDatabase();
  const { id } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; lines can no longer be added');
  }

  try {
    const line = buildLineItem(parsed.data);
    // Mongoose assigns `_id` when the subdocument is constructed on push;
    // buildLineItem() intentionally omits it since it doesn't exist yet.
    doc.lineItems.push(line as LineItemDoc);
  } catch (err) {
    if (err instanceof CalculationError) return errorResponse(400, err.message);
    throw err;
  }

  recomputeTotals(doc);
  await doc.save();

  return NextResponse.json(serializeDocument(doc), { status: 201 });
}
