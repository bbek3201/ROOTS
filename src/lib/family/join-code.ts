/**
 * Family join codes, on the client side.
 *
 * The code a family passes around is eight characters of Crockford base32 —
 * `7K3D-9F2A` — chosen because it survives being read out loud. The alphabet
 * leaves out I, L, O and U, and this module folds the mistakes people make
 * anyway back to what was meant: a typed O is a zero, an I or an L is a one.
 *
 * The same normalisation exists in SQL (`roots.normalize_join_code`), because
 * the database must not depend on the client having cleaned anything up. This
 * copy exists so the input can be tidied AS SOMEONE TYPES, which is the
 * difference between a field that feels broken and one that feels forgiving.
 */

/** Characters a generated code can contain. */
export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;

/** Letters that are read as digits, and the digit they are read as. */
const FOLD: Record<string, string> = { O: '0', I: '1', L: '1' };

/**
 * Everything typed, reduced to the characters a code is made of.
 * Never rejects — this runs on every keystroke, including half-typed codes.
 */
export function cleanJoinCodeInput(input: string): string {
  let out = '';
  for (const character of input.toUpperCase()) {
    const folded = FOLD[character] ?? character;
    // U is dropped rather than mapped: it never appears in a real code, so
    // turning it into a V would invent a code instead of rejecting a typo.
    if (folded !== 'U' && JOIN_CODE_ALPHABET.includes(folded)) out += folded;
    if (out.length === CODE_LENGTH) break;
  }
  return out;
}

/** What the field shows while it is being typed: `7K3D-9F2A`. */
export function formatJoinCode(input: string): string {
  const cleaned = cleanJoinCodeInput(input);
  return cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
}

/** The canonical form, or null when it is not a whole code yet. */
export function normalizeJoinCode(input: string): string | null {
  const cleaned = cleanJoinCodeInput(input);
  return cleaned.length === CODE_LENGTH ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : null;
}

export function isCompleteJoinCode(input: string): boolean {
  return normalizeJoinCode(input) !== null;
}

/**
 * A pasted invite URL, reduced to the code inside it.
 *
 * People paste whatever they were sent — a bare code, a whole sentence from a
 * group chat, or a link. Anything that contains eight usable characters is
 * treated as the code it obviously is.
 */
export function extractJoinCode(pasted: string): string | null {
  const fromQuery = /[?&]code=([^&\s]+)/i.exec(pasted)?.[1];
  return normalizeJoinCode(fromQuery ? decodeURIComponent(fromQuery) : pasted);
}
