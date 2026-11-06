import { describe, expect, it } from 'vitest';
import { countFingers, fingerState } from '../src/index.js';
import { FIST, ONE, OPEN, THREE, TWO, hand } from './hands.js';

describe('countFingers', () => {
  it('counts an open hand as 5', () => expect(countFingers(hand(OPEN))).toBe(5));
  it('counts a fist as 0', () => expect(countFingers(hand(FIST))).toBe(0));
  it('counts index only as 1', () => {
    expect(countFingers(hand(ONE))).toBe(1);
    expect(fingerState(hand(ONE)).index).toBe(true);
  });
  it('counts index + middle as 2', () => expect(countFingers(hand(TWO))).toBe(2));
  it('counts index + middle + ring as 3', () => expect(countFingers(hand(THREE))).toBe(3));
});
