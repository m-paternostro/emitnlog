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
      // clear() is a logical no-op on an already-empty set — postcondition already satisfied
      expect(() => (set as Set<unknown>).clear()).not.toThrow();
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
      // clear() is a logical no-op on an already-empty map — postcondition already satisfied
      expect(() => (map as Map<unknown, unknown>).clear()).not.toThrow();
      expect(map).toEqual(new Map());
    });

    test('clear() leaves the map still empty and usable', () => {
      const map = emptyMap<string, number>();
      (map as Map<string, number>).clear();
      expect(map.size).toBe(0);
      expect(map).toEqual(new Map());
    });
  });

  describe('mutation semantics', () => {
    test('emptySet add() throws because postcondition is unsatisfiable', () => {
      expect(() => (emptySet<number>() as Set<number>).add(42)).toThrow(TypeError);
    });

    test('emptySet delete() returns false (element is not present) without throwing', () => {
      expect(() => (emptySet<number>() as Set<number>).delete(42)).not.toThrow();
      expect((emptySet<number>() as Set<number>).delete(42)).toBe(false);
    });

    test('emptySet clear() is a no-op without throwing', () => {
      expect(() => (emptySet<number>() as Set<number>).clear()).not.toThrow();
      expect(emptySet<number>().size).toBe(0);
    });

    test('emptyMap set() throws because postcondition is unsatisfiable', () => {
      expect(() => (emptyMap<string, number>() as Map<string, number>).set('k', 1)).toThrow(TypeError);
    });

    test('emptyMap delete() returns false (key is not present) without throwing', () => {
      expect(() => (emptyMap<string, number>() as Map<string, number>).delete('k')).not.toThrow();
      expect((emptyMap<string, number>() as Map<string, number>).delete('k')).toBe(false);
    });

    test('emptyMap clear() is a no-op without throwing', () => {
      expect(() => (emptyMap<string, number>() as Map<string, number>).clear()).not.toThrow();
      expect(emptyMap<string, number>().size).toBe(0);
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
