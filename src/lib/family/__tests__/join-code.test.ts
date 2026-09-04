import { describe, expect, it } from 'vitest';
import {
  cleanJoinCodeInput,
  extractJoinCode,
  formatJoinCode,
  isCompleteJoinCode,
  normalizeJoinCode,
} from '../join-code';

describe('join codes', () => {
  it('normalises what people actually type', () => {
    expect(normalizeJoinCode('7k3d9f2a')).toBe('7K3D-9F2A');
    expect(normalizeJoinCode('7K3D-9F2A')).toBe('7K3D-9F2A');
    expect(normalizeJoinCode(' 7k3d 9f2a ')).toBe('7K3D-9F2A');
    expect(normalizeJoinCode('7K3D—9F2A')).toBe('7K3D-9F2A');
  });

  it('folds the letters the alphabet leaves out back to their digits', () => {
    // A code read aloud as "oh-one-el-eye" is 0-1-1-1.
    expect(normalizeJoinCode('OIL1-2345')).toBe('0111-2345');
  });

  it('drops U rather than inventing a V in its place', () => {
    // Eight characters, one of them a U: the result is short, so it is not a
    // code — which is the honest answer, not a different family's code.
    expect(normalizeJoinCode('7K3U-9F2A')).toBeNull();
  });

  it('refuses anything that is not a whole code', () => {
    expect(normalizeJoinCode('')).toBeNull();
    expect(normalizeJoinCode('7K3D')).toBeNull();
    expect(isCompleteJoinCode('7K3D-9F2')).toBe(false);
    expect(isCompleteJoinCode('7K3D-9F2A')).toBe(true);
  });

  it('stops at eight characters however much is pasted', () => {
    expect(cleanJoinCodeInput('7K3D9F2AZZZZ')).toBe('7K3D9F2A');
  });

  it('formats as it is typed, without a trailing dash', () => {
    expect(formatJoinCode('7k3')).toBe('7K3');
    expect(formatJoinCode('7k3d')).toBe('7K3D');
    expect(formatJoinCode('7k3d9')).toBe('7K3D-9');
  });

  it('finds the code inside a pasted link or message', () => {
    expect(extractJoinCode('https://roots.app/join?code=7K3D-9F2A')).toBe('7K3D-9F2A');
    // A code pasted inside a sentence still reads: everything that is not a
    // code character is skipped, which is what makes pasting from a group chat
    // work at all.
    expect(extractJoinCode('манай код: 7k3d-9f2a байгаа шүү')).toBe('7K3D-9F2A');
    expect(extractJoinCode('7k3d-9f2a')).toBe('7K3D-9F2A');
  });
});
