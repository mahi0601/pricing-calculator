import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { documentUpdateSchema } from '@/lib/validation';
import { serializeDocument } from '@/lib/documents';
import { loadOwnedDocument } from '@/lib/loadOwnedDocument';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  await connectToDatabase();
  const { id } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  return NextResponse.json(serializeDocument(doc));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const parsed = await parseJson(request, documentUpdateSchema);
  if (parsed.error) return parsed.error;

  await connectToDatabase();
  const { id } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and is read-only; metadata can no longer be edited');
  }

  const { title, customer, issueDate } = parsed.data;
  if (title !== undefined) doc.title = title;
  if (customer !== undefined) doc.customer = customer;
  if (issueDate !== undefined) doc.issueDate = issueDate;
  await doc.save();

  return NextResponse.json(serializeDocument(doc));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  await connectToDatabase();
  const { id } = await params;
  const doc = await loadOwnedDocument(userId, id);
  if (!doc) return errorResponse(404, 'Document not found');

  if (doc.status === 'finalized') {
    return errorResponse(409, 'Document is finalized and cannot be deleted');
  }

  await doc.deleteOne();
  return NextResponse.json({ ok: true });
}
