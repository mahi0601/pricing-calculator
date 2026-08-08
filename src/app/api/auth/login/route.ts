import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { createSessionToken, sessionCookieOptions, verifyPassword } from '@/lib/auth';
import { parseJson, errorResponse } from '@/lib/http';
import { loginSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, loginSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email));
  // Same error for unknown email and wrong password — do not reveal which one failed.
  const invalidCredentials = () => errorResponse(401, 'Invalid email or password');
  if (!user) return invalidCredentials();

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return invalidCredentials();

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ id: user.id, email: user.email });
  response.cookies.set(sessionCookieOptions.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionCookieOptions.maxAge,
  });
  return response;
}
