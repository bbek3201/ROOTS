/**
 * Turning a PostgREST failure into something a family member can act on.
 *
 * The default here stays deliberately vague — a Postgres message names tables,
 * columns and sometimes values, and this archive is private. The exception is
 * the class of error that means the archive is *not set up at all*: those are
 * not the user's fault and no amount of retrying fixes them, so they say so
 * plainly instead of inviting a fifth attempt at the same button.
 */
export function describeRpcError(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message =
    typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

  // PGRST202/205: PostgREST cannot find the function or table. In practice this
  // means the migrations in supabase/migrations were never applied to this
  // project — see supabase/schema.sql.
  // The message test matters because some call sites rethrow as a plain Error
  // and only the text survives.
  if (code === 'PGRST202' || code === 'PGRST205' || message.includes('schema cache')) {
    return 'Өгөгдлийн сангийн бүтэц суулгагдаагүй байна. supabase/migrations-ыг төсөл дээрээ ажиллуулна уу.';
  }
  if (code === '42501' || message.toLowerCase().includes('permission denied')) {
    return 'Танд энэ үйлдлийг хийх эрх алга.';
  }
  if (message.toLowerCase().includes('failed to fetch')) {
    return 'Сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгана уу.';
  }
  return fallback;
}
