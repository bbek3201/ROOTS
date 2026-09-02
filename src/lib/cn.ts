/** Join class names, dropping falsy values. Small on purpose — no dependency. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
