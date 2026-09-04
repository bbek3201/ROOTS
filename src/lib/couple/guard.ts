import 'server-only';

import { redirect } from 'next/navigation';
import { getMyCoupleSpace, type CoupleSpace } from './space';

/**
 * Every room in the couple space starts here.
 *
 * There is no id in these URLs, deliberately: a couple space belongs to whoever
 * is signed in or to nobody, so there is nothing for a URL to address and
 * nothing for someone to guess. A visitor with no space is sent to make one
 * rather than shown an empty room.
 */
export async function requireMySpace(): Promise<CoupleSpace> {
  const mine = await getMyCoupleSpace();
  if (!mine) redirect('/us/start');
  return mine;
}
