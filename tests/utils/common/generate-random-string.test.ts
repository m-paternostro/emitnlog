import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { generateRandomString } from '../../../src/utils/index.ts';

describe('emitnlog.utils.generateRandomString', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should generate a string of default length (32)', () => {
    const id = generateRandomString();
    expect(id).toHaveLength(32);
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

  test('should throw error when length is less than 32', () => {
    expect(() => generateRandomString(31)).toThrow('IllegalArgument: length must be a number between 32 and 128');
    expect(() => generateRandomString(0)).toThrow('IllegalArgument: length must be a number between 32 and 128');
    expect(() => generateRandomString(-1)).toThrow('IllegalArgument: length must be a number between 32 and 128');
  });

  test('should throw error when length is greater than 128', () => {
    expect(() => generateRandomString(129)).toThrow('IllegalArgument: length must be a number between 32 and 128');
    expect(() => generateRandomString(1000)).toThrow('IllegalArgument: length must be a number between 32 and 128');
    expect(() => generateRandomString(Number.MAX_SAFE_INTEGER)).toThrow(
      'IllegalArgument: length must be a number between 32 and 128',
    );
  });

  test('should generate unique strings', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = generateRandomString();
      expect(ids.has(id)).toBe(false);
      expect(id).toHaveLength(32);
      ids.add(id);
    }
  });

  test('should use all character types', () => {
    // Mock Math.random to return different values to ensure we get different characters
    const mockRandom = jest.spyOn(Math, 'random');
    mockRandom
      .mockReturnValueOnce(0) // 'A'
      .mockReturnValueOnce(0.5) // 'n'
      .mockReturnValueOnce(0.99); // '9'

    const id = generateRandomString();
    expect(id).toMatch(/[A-Z]/); // Contains uppercase
    expect(id).toMatch(/[a-z]/); // Contains lowercase
    expect(id).toMatch(/[0-9]/); // Contains number

    mockRandom.mockRestore();
  });
});
