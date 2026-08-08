import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/lib/models/User';
import { createSessionToken, hashPassword, sessionCookieOptions } from '@/lib/auth';
import { parseJson, errorResponse } from '@/lib/http';
import { signupSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, signupSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  await connectToDatabase();

  const existing = await User.findOne({ email });
  if (existing) {
    return errorResponse(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, passwordHash });

  const token = await createSessionToken(user._id.toString());
  const response = NextResponse.json({ id: user._id.toString(), email: user.email }, { status: 201 });
  response.cookies.set(sessionCookieOptions.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionCookieOptions.maxAge,
  });
  return response;
}
