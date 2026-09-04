import { describe, expect, it } from 'vitest';
import { ACTIONS, DESTINATIONS, TAB_BAR, UTILITIES, activeHref } from '../nav';

describe('navigation', () => {
  it('lights the most specific destination, never two at once', () => {
    // The bug this rule exists to kill: /family/tree also starts with /family.
    expect(activeHref('/family')).toBe('/family');
    expect(activeHref('/family/tree')).toBe('/family/tree');
    expect(activeHref('/memories/abc-123')).toBe('/memories');
    expect(activeHref('/memories/new')).toBe('/memories');
    expect(activeHref('/timeline')).toBe('/timeline');
    expect(activeHref('/interview/abc-123')).toBe('/interview');
  });

  it('keeps a page inside the destination it belongs to', () => {
    // Walking into a relative must not clear the navigation.
    expect(activeHref('/person/abc')).toBe('/family/tree');
    expect(activeHref('/couple/abc')).toBe('/family/tree');
    expect(activeHref('/family/add-person')).toBe('/family/tree');
  });

  it('resolves family settings to the profile, not to the family', () => {
    expect(activeHref('/settings/family', TAB_BAR)).toBe('/profile');
  });

  it('lights nothing on a page that is not a destination', () => {
    expect(activeHref('/login')).toBeNull();
    // Түүхүүд has no tab, so on a phone the bar honestly shows nothing rather
    // than highlighting a destination the reader is not in.
    expect(activeHref('/interview', TAB_BAR)).toBeNull();
  });

  it('offers every destination somewhere a phone can reach', () => {
    const menu = new Set([...DESTINATIONS, ...UTILITIES, ...ACTIONS].map((item) => item.href));
    for (const item of DESTINATIONS) expect(menu.has(item.href)).toBe(true);
    // The tab bar is a subset of the map, never its own invention.
    for (const tab of TAB_BAR) expect(menu.has(tab.href)).toBe(true);
  });
});
