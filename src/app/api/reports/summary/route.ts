import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { documents } from '@/lib/schema';
import { getUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { centsToDollars } from '@/lib/calc';
import { reportQuerySchema } from '@/lib/validation';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const searchParams = request.nextUrl.searchParams;
  const rawStatus = searchParams.get('status');
  if (rawStatus && rawStatus !== 'draft' && rawStatus !== 'finalized') {
    return errorResponse(400, 'status must be "draft" or "finalized"');
  }
  const status = rawStatus as 'draft' | 'finalized' | null;

  const parsed = reportQuerySchema.safeParse({ from: searchParams.get('from'), to: searchParams.get('to') });
  if (!parsed.success) {
    return errorResponse(
      400,
      'Validation failed',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    );
  }
  const { from, to } = parsed.data;
  if (from > to) return errorResponse(400, '"from" must not be after "to"');

  // "to" is treated as inclusive of the whole calendar day.
  const toExclusive = new Date(to.getTime() + ONE_DAY_MS);

  const db = getDb();

  const whereClause = and(
    eq(documents.userId, userId),
    gte(documents.issueDate, from),
    lt(documents.issueDate, toExclusive),
    ...(status ? [eq(documents.status, status)] : [])
  );

  const [row] = await db
    .select({
      documentCount: sql<string>`count(*)`,
      grandTotalCents: sql<string>`coalesce(sum(${documents.grandTotalCents}), 0)`,
      totalTaxCents: sql<string>`coalesce(sum(${documents.totalTaxCents}), 0)`,
      totalDiscountCents: sql<string>`coalesce(sum(${documents.totalDiscountCents}), 0)`,
    })
    .from(documents)
    .where(whereClause);

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    documentCount: Number(row.documentCount),
    grandTotal: centsToDollars(Number(row.grandTotalCents)),
    totalTax: centsToDollars(Number(row.totalTaxCents)),
    totalDiscount: centsToDollars(Number(row.totalDiscountCents)),
  });
}
