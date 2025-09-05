import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { LogLevel } from '../../../src/logger/index.ts';
import { emitter } from '../../../src/logger/index.ts';

describe('emitnlog.logger.emitter.emitter-logger', () => {
  describe('createLogger', () => {
    let capturedLogs: { level: LogLevel; message: string; args: readonly unknown[] }[];
    let testSink: emitter.LogSink['sink'];

    beforeEach(() => {
      capturedLogs = [];
      testSink = (level: LogLevel, message: string, args: readonly unknown[]) => {
        capturedLogs.push({ level, message, args });
      };
    });

    test('should create a logger with a simple sink function', () => {
      const logger = emitter.createLogger('info', testSink);

      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
      expect(logger.flush).toBeUndefined();
      expect(logger.close).toBeUndefined();
    });

    test('should create a logger with a full LogSink object', () => {
      const flushMock = jest.fn<() => void>();
      const closeMock = jest.fn<() => void>();
      const fullSink: emitter.LogSink = { sink: testSink, flush: flushMock, close: closeMock };

      const logger = emitter.createLogger('debug', fullSink);

      expect(logger).toBeDefined();
      expect(logger.level).toBe('debug');
      expect(logger.flush).toBeDefined();
      expect(logger.close).toBeDefined();
    });

    test('should emit logs to the provided sink', () => {
      const logger = emitter.createLogger('trace', testSink);

      logger.info('Test message', 'arg1', 42);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toEqual({ level: 'info', message: 'Test message', args: ['arg1', 42] });
    });

    test('should respect log level filtering', () => {
      const logger = emitter.createLogger('warning', testSink);

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warning('Warning message');
      logger.error('Error message');

      expect(capturedLogs).toHaveLength(2);
      expect(capturedLogs[0].level).toBe('warning');
      expect(capturedLogs[1].level).toBe('error');
    });

    test('should support dynamic level function', () => {
      let currentLevel: LogLevel | 'off' = 'info';
      const logger = emitter.createLogger(() => currentLevel, testSink);

      logger.debug('Debug 1');
      logger.info('Info 1');

      currentLevel = 'debug';

      logger.debug('Debug 2');
      logger.info('Info 2');

      expect(capturedLogs).toHaveLength(3);
      expect(capturedLogs.map((log) => log.message)).toEqual(['Info 1', 'Debug 2', 'Info 2']);
    });

    test('should handle off level correctly', () => {
      const logger = emitter.createLogger('off', testSink);

      logger.trace('Trace');
      logger.debug('Debug');
      logger.info('Info');
      logger.warning('Warning');
      logger.error('Error');
      logger.critical('Critical');
      logger.alert('Alert');
      logger.emergency('Emergency');

      expect(capturedLogs).toHaveLength(0);
    });

    test('should support all log levels', () => {
      const logger = emitter.createLogger('trace', testSink);

      logger.trace('Trace message');
      logger.debug('Debug message');
      logger.info('Info message');
      logger.notice('Notice message');
      logger.warning('Warning message');
      logger.error('Error message');
      logger.critical('Critical message');
      logger.alert('Alert message');
      logger.emergency('Emergency message');

      expect(capturedLogs).toHaveLength(9);
      const levels = capturedLogs.map((log) => log.level);
      expect(levels).toEqual([
        'trace',
        'debug',
        'info',
        'notice',
        'warning',
        'error',
        'critical',
        'alert',
        'emergency',
      ]);
    });

    test('should support template literal logging', () => {
      const logger = emitter.createLogger('trace', testSink);

      const value1 = 42;
      const value2 = 'test';
      logger.i`Template with ${value1} and ${value2}`;

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('info');
      expect(capturedLogs[0].message).toBe('Template with 42 and test');
      expect(capturedLogs[0].args).toEqual([]);
    });

    test('should support lazy template literal evaluation', () => {
      const logger = emitter.createLogger('trace', testSink);

      let counter = 0;
      const getValue = () => ++counter;

      // Create lazy template that returns proper TemplateStringsArray
      const createLazyTemplate = () => {
        const strings = [`Lazy template with value: `, ''] as unknown as string[];
        Object.defineProperty(strings, 'raw', { value: [`Lazy template with value: `, ''] });
        return strings as unknown as TemplateStringsArray;
      };

      logger.i(createLazyTemplate, getValue());

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('Lazy template with value:');
    });

    test('should handle error input correctly', () => {
      const logger = emitter.createLogger('trace', testSink);

      const error = new Error('Test error');
      logger.error(error);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('error');
      expect(capturedLogs[0].message).toBe('Test error');
      expect(capturedLogs[0].args).toContainEqual(error);
    });

    test('should handle error object wrapper correctly', () => {
      const logger = emitter.createLogger('trace', testSink);

      const customError = { message: 'Custom error', code: 500 };
      logger.error({ error: customError });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('error');
      // The error property is extracted and its value is stringified
      expect(capturedLogs[0].message).toBe(JSON.stringify(customError));
      expect(capturedLogs[0].args).toEqual([{ error: customError }]);
    });

    test('should support args() method', () => {
      const logger = emitter.createLogger('trace', testSink);

      const context = { requestId: '123' };
      logger.args(context).info('Request processed');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toBe('Request processed');
      expect(capturedLogs[0].args).toContainEqual(context);
    });

    test('should support chaining multiple args() calls', () => {
      const logger = emitter.createLogger('trace', testSink);

      const context1 = { requestId: '123' };
      const context2 = { userId: 'user456' };
      logger.args(context1).args(context2).info('Request processed');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toBe('Request processed');
      expect(capturedLogs[0].args).toEqual([context1, context2]);
    });

    test('should invoke flush when available', async () => {
      const flushMock = jest.fn<() => void>();
      const fullSink: emitter.LogSink = { sink: testSink, flush: flushMock };

      const logger = emitter.createLogger('info', fullSink);

      expect(logger.flush).toBeDefined();
      await logger.flush?.();

      expect(flushMock).toHaveBeenCalledTimes(1);
    });

    test('should invoke close when available', async () => {
      const closeMock = jest.fn<() => void>();
      const fullSink: emitter.LogSink = { sink: testSink, close: closeMock };

      const logger = emitter.createLogger('info', fullSink);

      expect(logger.close).toBeDefined();
      await logger.close?.();

      expect(closeMock).toHaveBeenCalledTimes(1);
    });

    test('should handle async flush correctly', async () => {
      const flushPromise = Promise.resolve();
      const flushMock = jest.fn<() => Promise<void>>(() => flushPromise);
      const fullSink: emitter.LogSink = { sink: testSink, flush: flushMock };

      const logger = emitter.createLogger('info', fullSink);

      const result = logger.flush?.();
      expect(result).toBe(flushPromise);
      await result;

      expect(flushMock).toHaveBeenCalledTimes(1);
    });

    test('should handle async close correctly', async () => {
      const closePromise = Promise.resolve();
      const closeMock = jest.fn<() => Promise<void>>(() => closePromise);
      const fullSink: emitter.LogSink = { sink: testSink, close: closeMock };

      const logger = emitter.createLogger('info', fullSink);

      const result = logger.close?.();
      expect(result).toBe(closePromise);
      await result;

      expect(closeMock).toHaveBeenCalledTimes(1);
    });

    test('should support lazy message evaluation', () => {
      const logger = emitter.createLogger('trace', testSink);

      let messageEvaluated = false;
      const lazyMessage = () => {
        messageEvaluated = true;
        return 'Lazy message';
      };

      // When level is too high, message should not be evaluated
      const highLevelLogger = emitter.createLogger('error', testSink);
      highLevelLogger.info(lazyMessage);
      expect(messageEvaluated).toBe(false);

      // When level is appropriate, message should be evaluated
      logger.info(lazyMessage);
      expect(messageEvaluated).toBe(true);
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toBe('Lazy message');
    });

    test('should handle log() method correctly', () => {
      const logger = emitter.createLogger('trace', testSink);

      logger.log('info', 'Direct log message', 'arg1');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toEqual({ level: 'info', message: 'Direct log message', args: ['arg1'] });
    });

    test('should respect level when using log() method', () => {
      const logger = emitter.createLogger('warning', testSink);

      logger.log('debug', 'Debug via log');
      logger.log('warning', 'Warning via log');
      logger.log('error', 'Error via log');

      expect(capturedLogs).toHaveLength(2);
      expect(capturedLogs.map((log) => log.level)).toEqual(['warning', 'error']);
    });

    test('should handle errors in all error-level methods', () => {
      const logger = emitter.createLogger('trace', testSink);
      const error = new Error('Test error');

      logger.warning(error);
      logger.error(error);
      logger.critical(error);
      logger.alert(error);
      logger.emergency(error);

      expect(capturedLogs).toHaveLength(5);
      capturedLogs.forEach((log) => {
        expect(log.message).toBe('Test error');
        expect(log.args).toContainEqual(error);
      });
    });

    test('should use shorthand methods correctly', () => {
      const logger = emitter.createLogger('trace', testSink);

      logger.t`Trace`;
      logger.d`Debug`;
      logger.i`Info`;
      logger.n`Notice`;
      logger.w`Warning`;
      logger.e`Error`;
      logger.c`Critical`;
      logger.a`Alert`;
      logger.em`Emergency`;

      expect(capturedLogs).toHaveLength(9);
      const messages = capturedLogs.map((log) => log.message);
      expect(messages).toEqual([
        'Trace',
        'Debug',
        'Info',
        'Notice',
        'Warning',
        'Error',
        'Critical',
        'Alert',
        'Emergency',
      ]);
    });
  });
});
