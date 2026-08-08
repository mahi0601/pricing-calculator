import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { serializeDocument } from '@/lib/documents';
import { loadOwnedDocument } from '@/lib/loadOwnedDocument';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  await connectToDatabase();
  const { id } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is already finalized');
  }

  // Belt-and-suspenders re-validation: every line already satisfies these
  // invariants at write time (schema min bounds + calc.ts), so this should
  // never actually trip. Kept because the assignment calls it out explicitly
  // as a finalize-time check, and a defensive re-check here is cheap
  // insurance against a future bug upstream that skips normal write paths.
  const invalidLine = doc.lineItems.find((line) => !(line.quantity > 0) || !(line.unitPriceCents >= 0));
  if (invalidLine) {
    return errorResponse(400, 'Cannot finalize: one or more lines have invalid quantity or price');
  }

  doc.status = 'finalized';
  doc.finalizedAt = new Date();
  await doc.save();

  return NextResponse.json(serializeDocument(doc));
}
