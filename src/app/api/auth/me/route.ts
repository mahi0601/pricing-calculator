import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/lib/models/User';
import { getUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/http';

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse(401, 'Not authenticated');

  await connectToDatabase();
  const user = await User.findById(userId).lean();
  if (!user) return errorResponse(401, 'Not authenticated');

  return NextResponse.json({ id: user._id.toString(), email: user.email });
}
