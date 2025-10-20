import type { Mock } from 'vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { LogLevel } from '../../../src/logger/index.ts';
import { emitter } from '../../../src/logger/index.ts';
import { flushFakeTimePromises } from '../../test-kit.ts';

describe('emitnlog.logger.emitter.batch-sink', () => {
  let capturedLogs: { level: LogLevel; message: string; args: readonly unknown[] | undefined }[];
  let mockSink: emitter.LogSink;
  let flushMock: Mock<() => void>;
  let closeMock: Mock<() => void>;

  beforeEach(() => {
    capturedLogs = [];
    flushMock = vi.fn<() => void>();
    closeMock = vi.fn<() => void>();

    mockSink = {
      sink: vi.fn((level: LogLevel, message: string, args?: readonly unknown[]) => {
        capturedLogs.push({ level, message, args });
      }),
      flush: flushMock,
      close: closeMock,
    };
  });

  describe('batchSink', () => {
    test('should batch logs up to maxBufferSize', () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 3, flushDelayMs: 1000 });

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);
      expect(capturedLogs).toHaveLength(0); // Not flushed yet

      batchedSink.sink('info', 'Message 3', []); // Should trigger flush
      expect(capturedLogs).toHaveLength(3);
      expect(capturedLogs.map((log) => log.message)).toEqual(['Message 1', 'Message 2', 'Message 3']);
    });

    test('should flush after flushDelayMs with fake timers', async () => {
      vi.useFakeTimers();
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 100, flushDelayMs: 1000 });

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);

      expect(capturedLogs).toHaveLength(0);

      // Advance time and flush promises
      vi.advanceTimersByTime(1000);
      await flushFakeTimePromises();

      expect(capturedLogs).toHaveLength(2);
      expect(capturedLogs.map((log) => log.message)).toEqual(['Message 1', 'Message 2']);

      vi.useRealTimers();
    });

    test('should reset timer when buffer fills', async () => {
      vi.useFakeTimers();
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 2, flushDelayMs: 1000 });

      batchedSink.sink('info', 'Message 1', []);

      // Advance time partially
      vi.advanceTimersByTime(500);

      // This should flush immediately and reset timer
      batchedSink.sink('info', 'Message 2', []);
      expect(capturedLogs).toHaveLength(2);

      capturedLogs.length = 0;

      // Add another message
      batchedSink.sink('info', 'Message 3', []);

      // The timer should start fresh after the flush
      // Advance full 1000ms for the new timer
      vi.advanceTimersByTime(1000);
      await flushFakeTimePromises();

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toBe('Message 3');

      vi.useRealTimers();
    });

    test('should handle manual flush', async () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 100, flushDelayMs: 10000 });

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);

      expect(capturedLogs).toHaveLength(0);

      await batchedSink.flush();

      expect(capturedLogs).toHaveLength(2);
      expect(flushMock).toHaveBeenCalledTimes(1);
    });

    test('should handle close and flush remaining logs', async () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 100, flushDelayMs: 10000 });

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);

      expect(capturedLogs).toHaveLength(0);

      await batchedSink.close();

      expect(capturedLogs).toHaveLength(2);
      expect(closeMock).toHaveBeenCalledTimes(1);
    });

    test('should pass through logs after close', async () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 100, flushDelayMs: 1000 });

      await batchedSink.close();

      // After close, logs should pass through immediately
      batchedSink.sink('info', 'After close', []);
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toBe('After close');
    });

    test('should handle zero flushDelayMs (no batching)', async () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 100, flushDelayMs: 0 });

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);

      // Should pass through immediately
      expect(capturedLogs).toHaveLength(2);

      expect(flushMock).toHaveBeenCalledTimes(0);
      await batchedSink.flush();
      expect(flushMock).toHaveBeenCalledTimes(1);

      expect(closeMock).toHaveBeenCalledTimes(0);
      await batchedSink.close();
      expect(flushMock).toHaveBeenCalledTimes(1);
      expect(closeMock).toHaveBeenCalledTimes(1);
    });

    test('should preserve args in batched logs', () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 2, flushDelayMs: 1000 });

      const args1 = ['arg1', 42];
      const args2 = [{ key: 'value' }, true];

      batchedSink.sink('info', 'Message 1', args1);
      batchedSink.sink('error', 'Message 2', args2);

      expect(capturedLogs).toHaveLength(2);
      expect(capturedLogs[0]).toEqual({ level: 'info', message: 'Message 1', args: args1 });
      expect(capturedLogs[1]).toEqual({ level: 'error', message: 'Message 2', args: args2 });
    });

    test('should handle empty buffer flush gracefully', async () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 100, flushDelayMs: 1000 });

      await batchedSink.flush();
      expect(capturedLogs).toHaveLength(0);
      expect(flushMock).toHaveBeenCalledTimes(1);
    });

    test('should debounce multiple logs within delay', async () => {
      vi.useFakeTimers();
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 100, flushDelayMs: 1000 });

      // Add logs at different intervals
      batchedSink.sink('info', 'Message 1', []);
      vi.advanceTimersByTime(300);

      batchedSink.sink('info', 'Message 2', []);
      vi.advanceTimersByTime(300);

      batchedSink.sink('info', 'Message 3', []);
      vi.advanceTimersByTime(300);

      // Still within the debounce delay
      expect(capturedLogs).toHaveLength(0);

      // Complete the debounce delay from last log
      vi.advanceTimersByTime(700);
      await flushFakeTimePromises();

      // All should be flushed together
      expect(capturedLogs).toHaveLength(3);

      vi.useRealTimers();
    });

    test('should handle sink without flush/close methods', async () => {
      const simpleSink = { sink: vi.fn<emitter.LogSink['sink']>() };
      const batchedSink = emitter.batchSink(simpleSink, { maxBufferSize: 2, flushDelayMs: 1000 });

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);

      expect(simpleSink.sink).toHaveBeenCalledTimes(2);

      // These should not throw
      await batchedSink.flush();
      await batchedSink.close();
    });

    test('should handle large number of logs', () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 10, flushDelayMs: 1000 });

      // Add 25 logs
      for (let i = 0; i < 25; i++) {
        batchedSink.sink('info', `Message ${i}`, []);
      }

      // Should have flushed twice (at 10 and 20) with 5 remaining
      expect(capturedLogs).toHaveLength(20);
    });

    test('should preserve log order', () => {
      const batchedSink = emitter.batchSink(mockSink, { maxBufferSize: 5, flushDelayMs: 1000 });

      const levels: LogLevel[] = ['trace', 'debug', 'info', 'warning', 'error'];
      levels.forEach((level) => {
        batchedSink.sink(level, `${level} message`, []);
      });

      expect(capturedLogs).toHaveLength(5);
      expect(capturedLogs.map((log) => log.level)).toEqual(levels);
    });
  });

  describe('batchSizeSink', () => {
    test('should only flush based on size', async () => {
      vi.clearAllTimers();
      vi.useFakeTimers();
      capturedLogs = [];
      const batchedSink = emitter.batchSizeSink(mockSink, 3);

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);

      // Advance time significantly
      vi.advanceTimersByTime(100000);
      await flushFakeTimePromises();

      // Should not have flushed based on time
      expect(capturedLogs).toHaveLength(0);

      // Add third message to trigger size-based flush
      batchedSink.sink('info', 'Message 3', []);
      expect(capturedLogs).toHaveLength(3);

      vi.useRealTimers();
    });

    test('flush should forward buffered logs and call underlying flush', async () => {
      const batchedSink = emitter.batchSizeSink(mockSink, 3);

      batchedSink.sink('info', 'Message 1', []);
      batchedSink.sink('info', 'Message 2', []);

      expect(capturedLogs).toHaveLength(0);

      await batchedSink.flush();

      expect(capturedLogs.map((log) => log.message)).toEqual(['Message 1', 'Message 2']);
      expect(flushMock).toHaveBeenCalledTimes(1);
    });

    test('close should flush remaining logs and call underlying close', async () => {
      const batchedSink = emitter.batchSizeSink(mockSink, 3);

      batchedSink.sink('info', 'Message 1', []);

      expect(capturedLogs).toHaveLength(0);

      await batchedSink.close();

      expect(capturedLogs.map((log) => log.message)).toEqual(['Message 1']);
      expect(closeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchTimeSink', () => {
    test('should only flush based on time', async () => {
      vi.useFakeTimers();
      const batchedSink = emitter.batchTimeSink(mockSink, 1000);

      // Add many logs
      for (let i = 0; i < 100; i++) {
        batchedSink.sink('info', `Message ${i}`, []);
      }

      // Should not have flushed based on size
      expect(capturedLogs).toHaveLength(0);

      // Advance time to trigger flush
      vi.advanceTimersByTime(1000);
      await flushFakeTimePromises();

      expect(capturedLogs).toHaveLength(100);

      vi.useRealTimers();
    });
  });
});
