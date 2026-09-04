import { describe, expect, it, vi } from 'vitest';
import { isTransient, PermanentError, retry } from '../retry';

/** No real waiting, and no jitter, so the backoff is exactly assertable. */
const instant = { sleep: async () => {}, random: () => 0.5 };

describe('isTransient', () => {
  it('treats a missing status as transient — the request never arrived', () => {
    expect(isTransient(null)).toBe(true);
  });

  it('retries what the server says it cannot do right now', () => {
    expect(isTransient(500)).toBe(true);
    expect(isTransient(503)).toBe(true);
    expect(isTransient(429)).toBe(true);
    expect(isTransient(408)).toBe(true);
  });

  it('does not retry a refusal — the fifth attempt fails the same way', () => {
    expect(isTransient(400)).toBe(false);
    expect(isTransient(403)).toBe(false);
    expect(isTransient(404)).toBe(false);
    expect(isTransient(413)).toBe(false);
  });
});

describe('retry', () => {
  it('returns the first success without waiting', async () => {
    const task = vi.fn(async () => 'ok');
    await expect(retry(task, instant)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('keeps going through a dropped connection', async () => {
    const task = vi.fn(async (attempt: number) => {
      if (attempt < 3) throw new Error('Сервертэй холбогдож чадсангүй.');
      return 'ok';
    });

    await expect(retry(task, instant)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('gives up on a refusal immediately', async () => {
    const task = vi.fn(async () => {
      throw new PermanentError('Файл хэт том байна.');
    });

    await expect(retry(task, instant)).rejects.toThrow('Файл хэт том байна.');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('surfaces the last error once the attempts run out', async () => {
    const task = vi.fn(async () => {
      throw new Error('Сүлжээ тасарлаа.');
    });

    await expect(retry(task, { ...instant, attempts: 3 })).rejects.toThrow('Сүлжээ тасарлаа.');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('backs off further each time, so a struggling connection is not hammered', async () => {
    const waits: number[] = [];
    const task = async () => { throw new Error('nope'); };

    await retry(task, {
      ...instant,
      attempts: 4,
      baseDelayMs: 100,
      sleep: async (ms) => { waits.push(ms); },
    }).catch(() => {});

    expect(waits).toEqual([100, 200, 400]);
    expect(waits.every((wait, i) => i === 0 || wait > waits[i - 1]!)).toBe(true);
  });

  it('jitters the wait, so four phones on one hotspot do not retry in lockstep', async () => {
    const waitsFor = async (random: () => number) => {
      const waits: number[] = [];
      await retry(async () => { throw new Error('nope'); }, {
        attempts: 2,
        baseDelayMs: 1000,
        random,
        sleep: async (ms) => { waits.push(ms); },
      }).catch(() => {});
      return waits[0]!;
    };

    expect(await waitsFor(() => 0)).not.toBe(await waitsFor(() => 1));
  });

  it('tells the caller it is retrying, so the form can say so', async () => {
    const onRetry = vi.fn();
    await retry(async (attempt) => {
      if (attempt < 2) throw new Error('nope');
      return 'ok';
    }, { ...instant, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]![0]).toBe(1);
  });
});
