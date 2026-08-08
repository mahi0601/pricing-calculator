import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { PricingDocument } from '@/lib/models/Document';
import { getUserId } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { documentCreateSchema } from '@/lib/validation';
import { buildLineItem, recomputeTotals, serializeDocument } from '@/lib/documents';
import { CalculationError } from '@/lib/calc';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  if (status && status !== 'draft' && status !== 'finalized') {
    return errorResponse(400, 'status must be "draft" or "finalized"');
  }

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit') ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT));

  const filter: Record<string, unknown> = { userId };
  if (status) filter.status = status;

  const [documents, total] = await Promise.all([
    PricingDocument.find(filter)
      .sort({ issueDate: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PricingDocument.countDocuments(filter),
  ]);

  return NextResponse.json({
    documents: documents.map(serializeDocument),
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
  const { title, customer, issueDate, lineItems } = parsed.data;

  let builtLines;
  try {
    builtLines = lineItems.map(buildLineItem);
  } catch (err) {
    if (err instanceof CalculationError) return errorResponse(400, err.message);
    throw err;
  }

  await connectToDatabase();

  const doc = new PricingDocument({
    userId,
    title,
    customer,
    issueDate,
    status: 'draft',
    lineItems: builtLines,
  });
  recomputeTotals(doc);
  await doc.save();

  return NextResponse.json(serializeDocument(doc), { status: 201 });
}
