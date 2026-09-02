import 'server-only';

import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import type { AIProvenance, AiTaskName } from './record-types';

export type { AiTaskName } from './record-types';

/**
 * Persist the provenance of an AI call.
 *
 * ai_outputs has no client-facing INSERT policy — it is written only here, with
 * the service role, AFTER the caller's family access has already been checked.
 * Storing every call means a reader can always ask "which model wrote this, and
 * what was it looking at?" years later.
 *
 * A failure to record provenance must never break the feature for the user, so
 * this logs and returns null rather than throwing.
 */
export async function recordAiOutput(options: {
  familyId: string;
  task: AiTaskName;
  provenance: AIProvenance;
  subjectType?: string;
  subjectId?: string;
  inputSummary?: string;
  outputText?: string;
  outputJson?: unknown;
  userId?: string | null;
}): Promise<string | null> {
  if (!hasServiceRole()) {
    console.warn('[roots:ai] SUPABASE_SERVICE_ROLE_KEY is not set; AI provenance was not recorded.');
    return null;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('ai_outputs')
      .insert({
        family_id: options.familyId,
        task: options.task,
        provider: options.provenance.provider,
        model: options.provenance.model,
        is_mock: options.provenance.isMock,
        subject_type: options.subjectType ?? null,
        subject_id: options.subjectId ?? null,
        input_summary: options.inputSummary?.slice(0, 2000) ?? null,
        output_text: options.outputText ?? null,
        output_json: (options.outputJson ?? null) as never,
        grounded_on: options.provenance.groundedOn as never,
        latency_ms: options.provenance.latencyMs,
        created_by: options.userId ?? null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return data.id;
  } catch (error) {
    console.error('[roots:ai] failed to record provenance', error);
    return null;
  }
}
