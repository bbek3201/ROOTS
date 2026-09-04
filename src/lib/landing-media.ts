import 'server-only';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Photographs for the public landing page.
 *
 * The front door of a photography-led product cannot be built out of gradients
 * for ever, but it also cannot be built out of a family's private archive: the
 * pictures inside ROOTS belong to the people in them and are served through
 * short-lived signed URLs to members only. Nothing from the database may ever
 * appear on a page a stranger can open.
 *
 * So the landing page reads its own pictures from `public/landing/`. Drop files
 * in (any name; they are used in sorted order) and the page uses them. Leave
 * the folder empty and it composes itself out of the warm washes instead —
 * finished either way, never a broken image.
 */
const LANDING_DIR = join(process.cwd(), 'public', 'landing');
const IMAGE_PATTERN = /\.(jpe?g|png|webp|avif)$/i;

export function landingPhotographs(): string[] {
  try {
    return readdirSync(LANDING_DIR)
      .filter((name) => IMAGE_PATTERN.test(name))
      .sort()
      .map((name) => `/landing/${encodeURIComponent(name)}`);
  } catch {
    // No folder, no permissions, no photographs. All the same answer.
    return [];
  }
}
