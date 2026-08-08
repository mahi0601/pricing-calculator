import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { lineItemUpdateSchema } from '@/lib/validation';
import { buildLineItem, lineToApiInput, recomputeTotals, serializeDocument } from '@/lib/documents';
import { loadOwnedDocument } from '@/lib/loadOwnedDocument';
import { CalculationError } from '@/lib/calc';
import type { LineItemDoc } from '@/lib/models/Document';

type Params = { params: Promise<{ id: string; lineId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const parsed = await parseJson(request, lineItemUpdateSchema);
  if (parsed.error) return parsed.error;

  await connectToDatabase();
  const { id, lineId } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; lines can no longer be edited');
  }

  const index = doc.lineItems.findIndex((l) => l._id.toString() === lineId);
  if (index === -1) return errorResponse(404, 'Line item not found');

  const current = lineToApiInput(doc.lineItems[index]);
  const merged = { ...current, ...parsed.data };

  try {
    const updated = buildLineItem(merged);
    Object.assign(doc.lineItems[index], updated);
  } catch (err) {
    if (err instanceof CalculationError) return errorResponse(400, err.message);
    throw err;
  }

  recomputeTotals(doc);
  await doc.save();

  return NextResponse.json(serializeDocument(doc));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  await connectToDatabase();
  const { id, lineId } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; lines can no longer be removed');
  }

  const index = doc.lineItems.findIndex((l: LineItemDoc) => l._id.toString() === lineId);
  if (index === -1) return errorResponse(404, 'Line item not found');

  doc.lineItems.splice(index, 1);
  recomputeTotals(doc);
  await doc.save();

  return NextResponse.json(serializeDocument(doc));
}
