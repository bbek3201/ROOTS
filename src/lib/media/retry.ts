/**
 * Retrying the parts of an upload that fail for reasons the user cannot fix.
 *
 * ROOTS is used from a phone, often on a rural connection, by someone holding a
 * box of photographs their grandmother kept. The single most common failure is
 * not a bug or a rejected file — it is a connection that drops for four seconds
 * halfway through. Making that person start again is how a box of prints stays
 * in the box.
 *
 * So: retry what is worth retrying, and nothing else. A file that is too large,
 * a type that is not allowed, or a family the uploader is not in will fail
 * exactly the same way on the fifth attempt as on the first, and retrying it
 * only delays telling them.
 */

/** Thrown when the archive refuses the request outright. Never retried. */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

/**
 * Is this worth trying again?
 *
 * A dropped connection surfaces as a TypeError from fetch with no status at
 * all, which is why the absence of a status counts as transient. Server errors
 * and rate limits are the server saying "not now"; every other status is the
 * server saying "not ever", and is passed straight through.
 */
export function isTransient(status: number | null): boolean {
  if (status === null) return true;   // network failure, DNS, aborted socket
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export interface RetryOptions {
  /** Total attempts, including the first. */
  attempts?: number;
  /** First backoff in ms; each subsequent wait doubles. */
  baseDelayMs?: number;
  /** Called before each wait, so the UI can say "дахин оролдож байна". */
  onRetry?: (attempt: number, delayMs: number) => void;
  /** Injected in tests; real callers get setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected in tests; real callers get Math.random. */
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `task` until it succeeds, it fails permanently, or the attempts run out.
 *
 * The backoff is jittered. Without jitter, a family sitting together after a
 * funeral uploading photographs from four phones on one hotspot retries in
 * lockstep and knocks the connection over again at exactly the same moment.
 */
export async function retry<T>(
  task: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const base = options.baseDelayMs ?? 600;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      // A refusal is a refusal. Do not spend thirty seconds confirming it.
      if (error instanceof PermanentError) throw error;
      if (attempt === attempts) break;

      const delay = Math.round(base * 2 ** (attempt - 1) * (0.5 + random()));
      options.onRetry?.(attempt, delay);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Сүлжээний алдаа. Дахин оролдоно уу.');
}

/**
 * A fetch that retries the transient failures and refuses to retry the rest.
 *
 * The response body is read here rather than by the caller: a 4xx carries the
 * message the family should actually see, and it has to be pulled out before
 * the response is discarded and the attempt is classified as permanent.
 */
export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  fallbackMessage: string,
  options: RetryOptions = {},
): Promise<unknown> {
  return retry(async () => {
    let response: Response;
    try {
      response = await fetch(input, init);
    } catch {
      // No status at all: the request never reached the server.
      throw new Error('Сервертэй холбогдож чадсангүй.');
    }

    if (response.ok) return response.json().catch(() => ({}));

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = body?.error ?? fallbackMessage;

    if (isTransient(response.status)) throw new Error(message);
    throw new PermanentError(message);
  }, options);
}
