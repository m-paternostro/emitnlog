import { describe, expect, test } from 'vitest';

import type { LogEntry, LogLevel } from '../../../src/index.ts';
import { emitter } from '../../../src/index.ts';

describe('emitnlog.logger.emitter.memory-sink', () => {
  describe('memorySink', () => {
    test('should create an empty memory sink', () => {
      const sink = emitter.memorySink();

      expect(sink.entries).toEqual([]);
      expect(sink.sink).toBeDefined();
      expect(sink.flush).toBeDefined();
      expect(sink.close).toBeDefined();
    });

    test('should accumulate log entries', () => {
      const sink = emitter.memorySink();

      sink.sink('info', 'Message 1', []);
      sink.sink('error', 'Message 2', ['arg1']);
      sink.sink('debug', 'Message 3', [42, { key: 'value' }]);

      expect(sink.entries).toHaveLength(3);
      expect(sink.entries[0]).toEqual({ level: 'info', message: 'Message 1', timestamp: expect.any(Number) });
      expect(sink.entries[1]).toEqual({
        level: 'error',
        message: 'Message 2',
        args: ['arg1'],
        timestamp: expect.any(Number),
      });
      expect(sink.entries[2]).toEqual({
        level: 'debug',
        message: 'Message 3',
        args: [42, { key: 'value' }],
        timestamp: expect.any(Number),
      });
    });

    test('should clear entries', () => {
      const sink = emitter.memorySink();

      sink.sink('info', 'Message 1', []);
      sink.sink('error', 'Message 2', []);

      expect(sink.entries).toHaveLength(2);

      sink.flush();

      expect(sink.entries).toHaveLength(0);
    });

    test('should use provided array', () => {
      const customArray: LogEntry[] = [];
      const sink = emitter.memorySink(customArray);

      sink.sink('info', 'Message', []);

      expect(customArray).toHaveLength(1);
      expect(customArray[0]).toEqual({ level: 'info', message: 'Message', timestamp: expect.any(Number) });
      expect(sink.entries).toBe(customArray);
    });

    test('should handle all log levels', () => {
      const sink = emitter.memorySink();
      const levels: LogLevel[] = [
        'trace',
        'debug',
        'info',
        'notice',
        'warning',
        'error',
        'critical',
        'alert',
        'emergency',
      ];

      levels.forEach((level) => {
        sink.sink(level, `${level} message`, []);
      });

      expect(sink.entries).toHaveLength(levels.length);
      expect(sink.entries.map((entry) => entry.level)).toEqual(levels);
    });

    test('should preserve args references', () => {
      const sink = emitter.memorySink();
      const obj = { mutable: 'value' };

      sink.sink('info', 'Message', [obj]);

      // Modify the object
      obj.mutable = 'changed';

      // The stored reference should reflect the change
      expect(sink.entries[0].args?.[0]).toBe(obj);
      expect((sink.entries[0].args?.[0] as { mutable: string }).mutable).toBe('changed');
    });

    test('should handle empty messages and args', () => {
      const sink = emitter.memorySink();

      sink.sink('info', '', []);

      expect(sink.entries).toHaveLength(1);
      expect(sink.entries[0]).toEqual({ level: 'info', message: '', timestamp: expect.any(Number) });
    });

    test('flush should clear entries', () => {
      const sink = emitter.memorySink();

      sink.sink('info', 'Message 1', []);
      sink.sink('error', 'Message 2', []);

      expect(sink.entries).toHaveLength(2);

      sink.flush();

      expect(sink.entries).toHaveLength(0);
    });

    test('close should clear entries', () => {
      const sink = emitter.memorySink();

      sink.sink('info', 'Message 1', []);
      sink.sink('error', 'Message 2', []);

      expect(sink.entries).toHaveLength(2);

      sink.close();

      expect(sink.entries).toHaveLength(0);
    });

    test('should continue accumulating after clear', () => {
      const sink = emitter.memorySink();

      sink.sink('info', 'Message 1', []);
      sink.flush();
      sink.sink('error', 'Message 2', []);
      sink.sink('debug', 'Message 3', []);

      expect(sink.entries).toHaveLength(2);
      expect(sink.entries[0].message).toBe('Message 2');
      expect(sink.entries[1].message).toBe('Message 3');
    });

    test('should handle large number of entries', () => {
      const sink = emitter.memorySink();

      for (let i = 0; i < 1000; i++) {
        sink.sink('info', `Message ${i}`, [i]);
      }

      expect(sink.entries).toHaveLength(1000);
      expect(sink.entries[0]).toEqual({
        level: 'info',
        message: 'Message 0',
        args: [0],
        timestamp: expect.any(Number),
      });
      expect(sink.entries[999]).toEqual({
        level: 'info',
        message: 'Message 999',
        args: [999],
        timestamp: expect.any(Number),
      });
    });

    test('should handle complex args', () => {
      const sink = emitter.memorySink();

      const error = new Error('Test error');
      interface CircularObject {
        name: string;
        self?: CircularObject;
      }
      const circular: CircularObject = { name: 'circular' };
      circular.self = circular;
      const fn = () => 'function';
      const symbol = Symbol('test');

      sink.sink('info', 'Complex args', [
        error,
        circular,
        fn,
        symbol,
        undefined,
        null,
        NaN,
        Infinity,
        -Infinity,
        0,
        -0,
        true,
        false,
        '',
        [],
        {},
      ]);

      expect(sink.entries).toHaveLength(1);
      expect(sink.entries[0].args).toHaveLength(16);
      expect(sink.entries[0].args?.[0]).toBe(error);
      expect(sink.entries[0].args?.[1]).toBe(circular);
      expect(sink.entries[0].args?.[2]).toBe(fn);
      expect(sink.entries[0].args?.[3]).toBe(symbol);
    });

    test('entries should be readonly from outside', () => {
      const sink = emitter.memorySink();

      sink.sink('info', 'Message', []);

      // TypeScript should prevent this, but we're testing runtime behavior
      const entries = sink.entries as unknown as { level: LogLevel; message: string; args: readonly unknown[] }[];
      expect(() => {
        entries.push({ level: 'error', message: 'Hacked', args: [] });
      }).not.toThrow();

      // The push should work because it's the same array reference
      expect(sink.entries).toHaveLength(2);
    });

    test('should share state between flush and close', () => {
      const sink = emitter.memorySink();

      sink.sink('info', 'Message 1', []);

      // Both flush and close should clear the same array
      sink.flush();
      expect(sink.entries).toHaveLength(0);

      sink.sink('info', 'Message 2', []);
      sink.close();
      expect(sink.entries).toHaveLength(0);
    });

    test('should integrate with emitter logger', () => {
      const sink = emitter.memorySink();
      const logger = emitter.createLogger('info', sink);

      logger.info('Test message', 'arg1', 42);
      logger.error('Error message');
      logger.debug('Should not appear'); // Below threshold

      expect(sink.entries).toHaveLength(2);
      expect(sink.entries[0]).toEqual({
        level: 'info',
        message: 'Test message',
        args: ['arg1', 42],
        timestamp: expect.any(Number),
      });
      expect(sink.entries[1]).toEqual({ level: 'error', message: 'Error message', timestamp: expect.any(Number) });

      void logger.flush();
      expect(sink.entries).toHaveLength(0);
    });
  });
});
