import 'server-only';

import { serverEnv } from '@/lib/env';
import { AnthropicAIService } from './anthropic';
import { MockAIService } from './mock';
import type { AIService } from './types';

export * from './types';
export { MockAIService } from './mock';

/**
 * Provider selection.
 *
 * Falls back to the mock — loudly, via a one-time console warning — whenever a
 * provider is requested but not configured. It never silently pretends to be a
 * real model, because "the AI summarised this" is a claim the archive keeps
 * forever.
 */
let warned = false;

export function getAIService(): AIService {
  const env = serverEnv();

  if (env.ROOTS_AI_PROVIDER === 'anthropic') {
    if (env.ANTHROPIC_API_KEY) {
      return new AnthropicAIService(env.ANTHROPIC_API_KEY, env.ROOTS_AI_MODEL);
    }
    if (!warned) {
      warned = true;
      console.warn(
        '[roots:ai] ROOTS_AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. ' +
        'Falling back to the development mock; every AI result will be labelled as a mock.',
      );
    }
  }

  return new MockAIService();
}

/** What the UI shows in the AI status badge. */
export function aiStatus(): { configured: boolean; provider: string; model: string | null } {
  const env = serverEnv();
  const configured = env.ROOTS_AI_PROVIDER === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY);
  return {
    configured,
    provider: configured ? env.ROOTS_AI_PROVIDER : 'mock',
    model: configured ? env.ROOTS_AI_MODEL : null,
  };
}
