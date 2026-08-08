import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { getUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/http';

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return errorResponse(401, 'Not authenticated');

  return NextResponse.json({ id: user.id, email: user.email });
}
