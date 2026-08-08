import mongoose from 'mongoose';
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { centsToDollars } from '@/lib/calc';
import { PricingDocument } from '@/lib/models/Document';
import { reportQuerySchema } from '@/lib/validation';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  if (status && status !== 'draft' && status !== 'finalized') {
    return errorResponse(400, 'status must be "draft" or "finalized"');
  }

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

  await connectToDatabase();

  const match: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    issueDate: { $gte: from, $lt: toExclusive },
  };
  if (status) match.status = status;

  const [result] = await PricingDocument.aggregate<{
    documentCount: number;
    grandTotalCents: number;
    totalTaxCents: number;
    totalDiscountCents: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: null,
        documentCount: { $sum: 1 },
        grandTotalCents: { $sum: '$grandTotalCents' },
        totalTaxCents: { $sum: '$totalTaxCents' },
        totalDiscountCents: { $sum: '$totalDiscountCents' },
      },
    },
  ]);

  const summary = result ?? { documentCount: 0, grandTotalCents: 0, totalTaxCents: 0, totalDiscountCents: 0 };

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    documentCount: summary.documentCount,
    grandTotal: centsToDollars(summary.grandTotalCents),
    totalTax: centsToDollars(summary.totalTaxCents),
    totalDiscount: centsToDollars(summary.totalDiscountCents),
  });
}
