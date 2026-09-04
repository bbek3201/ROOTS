/**
 * Which family the browser is currently looking at.
 *
 * The name lives here, apart from `family-context`, because both sides need
 * it: the server reads the cookie, and the client writes it the moment someone
 * creates or joins an archive. `family-context` is `server-only`, so a client
 * component importing the constant from there would break the build — which is
 * why this file has no imports at all.
 *
 * The cookie is a CONVENIENCE, never a credential. It says which family to
 * show; whether the viewer may see it is decided server-side against their
 * memberships, and ultimately by RLS.
 */
export const ACTIVE_FAMILY_COOKIE = 'roots.family';

/** A year: long enough that the archive opens where you left it. */
const ONE_YEAR_SECONDS = 31_536_000;

export function rememberActiveFamily(familyId: string): void {
  document.cookie = `${ACTIVE_FAMILY_COOKIE}=${familyId}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
