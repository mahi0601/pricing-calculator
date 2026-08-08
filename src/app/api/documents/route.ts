import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { documents, lineItems } from '@/lib/schema';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { documentCreateSchema } from '@/lib/validation';
import { buildLineItem, recomputeTotals, serializeDocument, serializeDocumentSummary } from '@/lib/documents';
import { CalculationError } from '@/lib/calc';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const searchParams = request.nextUrl.searchParams;
  const rawStatus = searchParams.get('status');
  if (rawStatus && rawStatus !== 'draft' && rawStatus !== 'finalized') {
    return errorResponse(400, 'status must be "draft" or "finalized"');
  }
  const status = rawStatus as 'draft' | 'finalized' | null;

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit') ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT));

  const db = getDb();
  const whereClause = status ? and(eq(documents.userId, userId), eq(documents.status, status)) : eq(documents.userId, userId);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(whereClause)
      .orderBy(desc(documents.issueDate), desc(documents.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: sql<number>`count(*)::int` }).from(documents).where(whereClause),
  ]);

  return NextResponse.json({
    documents: rows.map(serializeDocumentSummary),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const parsed = await parseJson(request, documentCreateSchema);
  if (parsed.error) return parsed.error;
  const { title, customer, issueDate, lineItems: lineItemInputs } = parsed.data;

  let builtLines;
  try {
    builtLines = lineItemInputs.map(buildLineItem);
  } catch (err) {
    if (err instanceof CalculationError) return errorResponse(400, err.message);
    throw err;
  }

  const totals = recomputeTotals(builtLines);
  const db = getDb();

  const doc = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(documents)
      .values({ userId, title, customer, issueDate, status: 'draft', ...totals })
      .returning();

    const insertedLines = builtLines.length
      ? await tx
          .insert(lineItems)
          .values(builtLines.map((line, index) => ({ ...line, documentId: created.id, position: index })))
          .returning()
      : [];

    return { doc: created, lines: insertedLines };
  });

  return NextResponse.json(serializeDocument(doc.doc, doc.lines), { status: 201 });
}
