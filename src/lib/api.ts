import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AccessError, errorResponse } from '@/lib/auth/guards';

/**
 * Shared route-handler plumbing.
 *
 * The point of routing every handler through `handle` is that a thrown error
 * can never escape as a raw database message: Postgres errors name tables,
 * columns and sometimes values, and this archive is private.
 */
export function ok<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/** Parse and validate a JSON body, refusing anything that does not fit. */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AccessError('Хүсэлтийн агуулга буруу байна.', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AccessError(first ? `${first.path.join('.')}: ${first.message}` : 'Хүсэлт буруу байна.', 400);
  }
  return parsed.data;
}

export const uuidSchema = z.string().uuid('id буруу байна');
