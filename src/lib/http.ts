import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType } from 'zod';

export function errorResponse(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, ...(details !== undefined ? { details } : {}) }, { status });
}

type ParseResult<T> = { data: T; error?: undefined } | { data?: undefined; error: NextResponse };

export async function parseJson<T>(request: NextRequest, schema: ZodType<T>): Promise<ParseResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: errorResponse(400, 'Request body must be valid JSON') };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: errorResponse(
        400,
        'Validation failed',
        result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      ),
    };
  }

  return { data: result.data };
}
