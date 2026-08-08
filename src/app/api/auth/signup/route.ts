import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { createSessionToken, hashPassword, sessionCookieOptions } from '@/lib/auth';
import { parseJson, errorResponse } from '@/lib/http';
import { signupSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, signupSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return errorResponse(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    [user] = await db.insert(users).values({ email, passwordHash }).returning();
  } catch (err) {
    // Backstop against the check-then-insert race above: a concurrent signup
    // for the same email between the SELECT and this INSERT hits the unique
    // constraint instead of silently creating a duplicate account.
    if (err instanceof Error && 'code' in err && err.code === '23505') {
      return errorResponse(409, 'An account with this email already exists');
    }
    throw err;
  }

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  response.cookies.set(sessionCookieOptions.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionCookieOptions.maxAge,
  });
  return response;
}
