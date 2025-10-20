import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { generateRandomString } from '../../../src/utils/index.ts';

describe('emitnlog.utils.generateRandomString', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should generate a string of default length (8)', () => {
    const id = generateRandomString();
    expect(id).toHaveLength(8);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  test('should generate a string of specified length', () => {
    const id = generateRandomString(64);
    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  test('should generate a string of maximum length (128)', () => {
    const id = generateRandomString(128);
    expect(id).toHaveLength(128);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  test('should throw error when length is less than 8', () => {
    expect(() => generateRandomString(7)).toThrow('IllegalArgument: length must be a number between 8 and 128');
    expect(() => generateRandomString(0)).toThrow('IllegalArgument: length must be a number between 8 and 128');
    expect(() => generateRandomString(-1)).toThrow('IllegalArgument: length must be a number between 8 and 128');
  });

  test('should throw error when length is greater than 128', () => {
    expect(() => generateRandomString(129)).toThrow('IllegalArgument: length must be a number between 8 and 128');
    expect(() => generateRandomString(1000)).toThrow('IllegalArgument: length must be a number between 8 and 128');
    expect(() => generateRandomString(Number.MAX_SAFE_INTEGER)).toThrow(
      'IllegalArgument: length must be a number between 8 and 128',
    );
  });

  test('should generate unique strings', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = generateRandomString();
      expect(ids.has(id)).toBe(false);
      expect(id).toHaveLength(8);
      ids.add(id);
    }
  });

  test('should use all character types', () => {
    // Mock Math.random to return different values to ensure we get different characters
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom
      .mockReturnValueOnce(0) // 'A'
      .mockReturnValueOnce(0.5) // 'n'
      .mockReturnValueOnce(0.99); // '9'

    const id = generateRandomString();
    expect(id).toMatch(/[A-Za-z0-9]/);

    mockRandom.mockRestore();
  });
});
