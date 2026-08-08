import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { documents } from '@/lib/schema';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { documentUpdateSchema } from '@/lib/validation';
import { serializeDocument } from '@/lib/documents';
import { getLineItems, loadOwnedDocument } from '@/lib/documentQueries';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const db = getDb();
  const { id } = await params;
  const doc = await loadOwnedDocument(db, userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  const lines = await getLineItems(db, doc.id);
  return NextResponse.json(serializeDocument(doc, lines));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const parsed = await parseJson(request, documentUpdateSchema);
  if (parsed.error) return parsed.error;

  const db = getDb();
  const { id } = await params;
  const doc = await loadOwnedDocument(db, userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; metadata can no longer be edited');
  }

  const { title, customer, issueDate } = parsed.data;
  const [updated] = await db
    .update(documents)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(customer !== undefined ? { customer } : {}),
      ...(issueDate !== undefined ? { issueDate } : {}),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id))
    .returning();

  const lines = await getLineItems(db, doc.id);
  return NextResponse.json(serializeDocument(updated, lines));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const db = getDb();
  const { id } = await params;
  const doc = await loadOwnedDocument(db, userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and cannot be deleted');
  }

  // Line items cascade via the documents FK's ON DELETE CASCADE.
  await db.delete(documents).where(eq(documents.id, doc.id));
  return NextResponse.json({ ok: true });
}
