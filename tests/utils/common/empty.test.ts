import { describe, expect, test } from 'vitest';

import {
  EMPTY_ARRAY,
  EMPTY_MAP,
  EMPTY_RECORD,
  EMPTY_SET,
  emptyArray,
  emptyMap,
  emptyRecord,
  emptySet,
} from '../../../src/utils/index.ts';

describe('emitnlog.utils.empty', () => {
  describe('emptyArray', () => {
    test('should return the same immutable empty array', () => {
      expect(emptyArray()).toBe(emptyArray());
      expect(emptyArray()).toBe(EMPTY_ARRAY);
      expect(Object.isFrozen(emptyArray())).toBe(true);
      expect(emptyArray()).toEqual([]);
    });

    test('should not be able to modify the empty array', () => {
      const array: readonly Date[] = emptyArray();
      expect(() => (array as unknown[]).push(1)).toThrow(TypeError);
      expect(array).toEqual([]);
    });
  });

  describe('emptySet', () => {
    test('should return the same immutable empty set', () => {
      expect(emptySet()).toBe(emptySet());
      expect(emptySet()).toBe(EMPTY_SET);
      expect(Object.isFrozen(emptySet())).toBe(true);
      expect(emptySet()).toEqual(new Set());
    });

    test('should not be able to modify the empty set', () => {
      const set: ReadonlySet<number> = emptySet();
      expect(() => (set as Set<unknown>).add(1)).toThrow(TypeError);
      expect((set as Set<unknown>).delete(1)).toBe(false);
      expect(() => (set as Set<unknown>).clear()).toThrow(TypeError);
      expect(set).toEqual(new Set());
    });
  });

  describe('emptyMap', () => {
    test('should return the same immutable empty map', () => {
      expect(emptyMap()).toBe(emptyMap());
      expect(emptyMap()).toBe(EMPTY_MAP);
      expect(Object.isFrozen(emptyMap())).toBe(true);
      expect(emptyMap()).toEqual(new Map());
    });

    test('should not be able to modify the empty map', () => {
      const map: ReadonlyMap<string, unknown> = emptyMap();
      expect(() => (map as Map<unknown, unknown>).set('key', 1)).toThrow(TypeError);
      expect((map as Map<unknown, unknown>).delete('key')).toBe(false);
      expect(() => (map as Map<unknown, unknown>).clear()).toThrow(TypeError);
      expect(map).toEqual(new Map());
    });
  });

  describe('emptyRecord', () => {
    test('should return the same immutable empty record', () => {
      expect(emptyRecord()).toBe(emptyRecord());
      expect(emptyRecord()).toBe(EMPTY_RECORD);
      expect(Object.isFrozen(emptyRecord())).toBe(true);
      expect(emptyRecord()).toEqual({});
    });

    test('should not be able to modify the empty record', () => {
      const record: Readonly<Record<string, number>> = emptyRecord();
      expect(() => ((record as Record<string, unknown>).a = 1)).toThrow(TypeError);
      expect(record).toEqual({});
    });
  });
});
