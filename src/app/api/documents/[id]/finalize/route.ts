import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { documents } from '@/lib/schema';
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

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is already finalized');
  }

  const lines = await getLineItems(db, doc.id);

  // Belt-and-suspenders re-validation: every line already satisfies these
  // invariants at write time (schema constraints + calc.ts), so this should
  // never actually trip. Kept because the assignment calls it out explicitly
  // as a finalize-time check, and a defensive re-check here is cheap
  // insurance against a future bug upstream that skips normal write paths.
  const invalidLine = lines.find((line) => !(line.quantity > 0) || !(line.unitPriceCents >= 0));
  if (invalidLine) {
    return errorResponse(400, 'Cannot finalize: one or more lines have invalid quantity or price');
  }

  const [updated] = await db
    .update(documents)
    .set({ status: 'finalized', finalizedAt: new Date(), updatedAt: new Date() })
    .where(eq(documents.id, doc.id))
    .returning();

  return NextResponse.json(serializeDocument(updated, lines));
}
