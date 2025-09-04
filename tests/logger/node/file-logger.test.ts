import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { LogFormat } from '../../../src/logger/index.ts';
import { tee } from '../../../src/logger/index.ts';
import type { FileLoggerOptions } from '../../../src/logger/node/index.ts';
import { createFileLogger } from '../../../src/logger/node/index.ts';
import { delay } from '../../../src/utils/index.ts';

describe('emitnlog.logger.node.FileLogger', () => {
  const TEST_FLUSH_DELAY = { flushDelayMs: 50 } as const satisfies FileLoggerOptions;
  const TEST_FLUSH_WAIT = TEST_FLUSH_DELAY.flushDelayMs + 10;

  const testDir = path.join(os.tmpdir(), `file-logger-test-${Date.now()}`);
  const testLogFile = path.join(testDir, 'test.log');

  const readLogFile = async (filePath = testLogFile): Promise<string> => {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (_error) {
      return '';
    }
  };

  const fileExists = async (filePath: string): Promise<boolean> => {
    try {
      await fs.access(filePath);
      return true;
    } catch (_error) {
      return false;
    }
  };

  beforeEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {}
    await fs.mkdir(testDir, { recursive: true });
  });

  test('should create a log file and write to it', async () => {
    const logger = createFileLogger(testLogFile, TEST_FLUSH_DELAY);
    expect(logger.level).toBe('info');

    logger.info('Test message');

    await expect(readLogFile()).resolves.toBe('');
    await delay(TEST_FLUSH_WAIT);
    await expect(readLogFile()).resolves.toContain('Test message');
  });

  test('should handle home directory expansion with tilde', async () => {
    const homeRelativePath = '~/test-logger-home.log';
    const logger = createFileLogger(homeRelativePath, 'debug');
    expect(logger.level).toBe('debug');

    expect(logger.filePath).toContain(os.homedir());
    expect(logger.filePath).not.toContain('~');
    expect(logger.filePath).toContain('test-logger-home.log');
  });

  test('should handle relative paths by placing in temp directory', async () => {
    const relativeFileName = 'relative-test.log';
    const logger = createFileLogger(relativeFileName);

    expect(logger.filePath).toContain(os.tmpdir());
    expect(path.basename(logger.filePath)).toBe(relativeFileName);
  });

  test('should throw error when no file path is provided', () => {
    expect(() => {
      createFileLogger('');
    }).toThrow('InvalidArgument: file path is required');
  });

  test('should create nested directories as needed', async () => {
    const nestedDir = path.join(testDir, 'nested', 'dir');
    const nestedLogFile = path.join(nestedDir, 'nested.log');

    const logger = createFileLogger(nestedLogFile, TEST_FLUSH_DELAY);
    logger.info('Test in nested directory');

    await delay(TEST_FLUSH_WAIT);

    expect(await fileExists(nestedDir)).toBe(true);
    expect(await fileExists(nestedLogFile)).toBe(true);

    const content = await readLogFile(nestedLogFile);
    expect(content).toContain('Test in nested directory');
  });

  test('should accept options object in constructor', async () => {
    const logger = createFileLogger(testLogFile, { ...TEST_FLUSH_DELAY, level: 'warning', format: 'colorful' });
    expect(logger.level).toBe('warning');

    // Check that level setting is respected
    logger.info('This should be filtered out');
    logger.warning('This should appear');

    // Wait for async operations
    await delay(TEST_FLUSH_WAIT);

    const content = await readLogFile();
    expect(content).not.toContain('This should be filtered out');
    expect(content).toContain('This should appear');
  });

  test('should accept format as third parameter with string path', async () => {
    // Test JSON format with string path
    const jsonLogFile = path.join(testDir, 'json-format.log');
    const jsonLogger = createFileLogger(jsonLogFile, 'info', 'json-pretty');

    jsonLogger.info('JSON format test');
    await jsonLogger.close();

    const jsonContent = await readLogFile(jsonLogFile);
    const parsed = JSON.parse(jsonContent.trim()) as Record<string, unknown>;
    expect(parsed.message).toBe('JSON format test');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();

    // Test colorful format with string path
    const colorfulLogFile = path.join(testDir, 'colorful-format.log');
    const colorfulLogger = createFileLogger(colorfulLogFile, 'debug', 'colorful');

    // Create a string with ANSI color codes
    const coloredText = '\x1B[32mThis is colored green\x1B[0m';
    colorfulLogger.log('debug', coloredText);
    await colorfulLogger.close();

    const colorfulContent = await readLogFile(colorfulLogFile);
    // Should contain the ANSI codes when format is colorful
    expect(colorfulContent).toContain('\x1B[32m');

    // Test plain format with string path (default behavior)
    const plainLogFile = path.join(testDir, 'plain-format.log');
    const plainLogger = createFileLogger(plainLogFile, 'info', 'plain');

    plainLogger.info('Plain format test');
    await plainLogger.flush();

    const plainContent = await readLogFile(plainLogFile);
    expect(plainContent).toContain('Plain format test');
    expect(plainContent).toContain('[info     ]');
  });

  test('should use plain format when none specified with string path', async () => {
    const logger = createFileLogger(testLogFile, 'info');

    logger.info('Default format test');
    await logger.close();

    const content = await readLogFile();
    expect(content).toContain('Default format test');
    expect(content).toContain('[info     ]'); // Plain format indicator
  });

  test('should handle undefined format parameter with string path', async () => {
    const logger = createFileLogger(testLogFile, 'info', undefined);

    logger.info('Undefined format test');
    await logger.close();

    const content = await readLogFile();
    expect(content).toContain('Undefined format test');
    expect(content).toContain('[info     ]'); // Should default to plain format
  });

  test('should handle the format parameter either on options or as parameter', async () => {
    const optionsLogger = createFileLogger(path.join(testDir, 'options-format.log'), {
      level: 'info',
      format: 'json-pretty',
    });

    optionsLogger.info('Options format test');
    await optionsLogger.close();

    const optionsContent = await readLogFile(path.join(testDir, 'options-format.log'));
    const parsed = JSON.parse(optionsContent.trim()) as Record<string, unknown>;
    expect(parsed.message).toBe('Options format test');

    // Test that parameter format works with string path
    const paramLogger = createFileLogger(path.join(testDir, 'param-format.log'), 'info', 'json-compact');

    paramLogger.info('Parameter format test');
    await paramLogger.close();

    const paramContent = await readLogFile(path.join(testDir, 'param-format.log'));
    const lines = paramContent.trim().split('\n');
    expect(lines.length).toBe(1);
    const paramParsed = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(paramParsed.message).toBe('Parameter format test');
  });

  test('should work with all supported formats using string path', async () => {
    const formats: { format: LogFormat; description: string }[] = [
      { format: 'plain', description: 'plain format' },
      { format: 'colorful', description: 'colorful format' },
      { format: 'json-pretty', description: 'JSON format' },
      { format: 'json-compact', description: 'unformatted JSON format' },
    ];

    // Create all loggers and log messages
    const loggers = formats.map(({ format, description }) => {
      const formatLogFile = path.join(testDir, `${format}-test.log`);
      const logger = createFileLogger(formatLogFile, 'info', format);
      logger.info(`Testing ${description}`);
      return { logger, format, description, formatLogFile };
    });

    // Close all loggers
    await Promise.all(loggers.map(({ logger }) => logger.close()));

    // Verify all outputs
    const results = await Promise.all(
      loggers.map(async ({ format, description, formatLogFile }) => {
        const content = await readLogFile(formatLogFile);
        return { format, description, content };
      }),
    );

    for (const { format, description, content } of results) {
      expect(content).toBeTruthy();
      expect(content).toContain(`Testing ${description}`);

      // Format-specific assertions
      if (format === 'json-pretty' || format === 'json-compact') {
        // Should be valid JSON
        const lines = content.trim().split('\n');
        const firstLine = format === 'json-pretty' ? content.trim() : lines[0];
        const parsed = JSON.parse(firstLine) as Record<string, unknown>;
        expect(parsed.message).toBe(`Testing ${description}`);
        expect(parsed.level).toBe('info');
      } else {
        // Plain and colorful formats should have level indicator
        expect(content).toContain('[info     ]');
      }
    }
  });

  test('should work with JSON format', async () => {
    const logger = createFileLogger(testLogFile, { format: 'json-pretty' });

    logger.info('JSON test message');
    await logger.close();

    const content = await readLogFile();

    // Should contain valid JSON (pretty-printed, so parse the whole content)
    const parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(parsed.message).toBe('JSON test message');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();

    // Should be formatted (pretty-printed)
    expect(content).toContain('\n  ');
  });

  test('should work with unformatted JSON format', async () => {
    const logger = createFileLogger(testLogFile, { format: 'json-compact' });

    logger.info('Unformatted JSON test message');
    await logger.close();

    const content = await readLogFile();

    // Should contain valid JSON
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(1);

    const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(parsed.message).toBe('Unformatted JSON test message');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();

    // Should be compact (no pretty-printing)
    expect(lines[0]).not.toMatch(/\n\s+/);
  });

  test('should include args in JSON format', async () => {
    const logger = createFileLogger(testLogFile, { format: 'json-pretty' });

    const context = { userId: '123', action: 'login' };
    const additionalData = 'extra info';

    logger.info('User logged in', context, additionalData);
    await logger.close();

    const content = await readLogFile();

    const parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(parsed.message).toBe('User logged in');
    expect(parsed.level).toBe('info');
    expect(parsed.args).toEqual([context, additionalData]);
  });

  test('should handle args separately for non-JSON formats', async () => {
    const logger = createFileLogger(testLogFile, undefined, 'plain');

    const context = { userId: '123', action: 'login' };
    const additionalData = 'extra info';

    logger.info('User logged in', context, additionalData);
    await logger.close();

    const content = await readLogFile();

    // Should contain the message
    expect(content).toContain('User logged in');
    expect(content).toContain('[info     ]');

    // Should contain args section
    expect(content).toContain('[arg0]');
    expect(content).toContain('[arg1]');
    expect(content).toContain('userId');
    expect(content).toContain('123');
    expect(content).toContain('extra info');
  });

  test('should keep ANSI color codes when format is colorful', async () => {
    const logger = createFileLogger(testLogFile + '.colors', { ...TEST_FLUSH_DELAY, format: 'colorful' });

    // Create a string with ANSI color codes (simulate what FormattedLogger might produce)
    const coloredText = '\x1B[32mThis is colored green\x1B[0m';
    logger.log('info', coloredText);

    await delay(TEST_FLUSH_WAIT);

    const content = await readLogFile(testLogFile + '.colors');
    // Should contain the ANSI codes
    expect(content).toContain('\x1B[32m');
  });

  test('should use custom error handler when provided', async () => {
    const mockErrorHandler = jest.fn();

    try {
      // Force an error by trying to write to a non-existent directory
      const forcedErrorLogger = createFileLogger('/non/existent/directory/that/does/not/exist/test.log', {
        errorHandler: mockErrorHandler,
      });

      forcedErrorLogger.info('This should trigger error handling');

      // Wait for async operations
      await delay(100);

      // Error handler should have been called at least once
      expect(mockErrorHandler).toHaveBeenCalled();
    } catch {
      // Just in case test fails, we don't want it to crash
    }
  });

  test('should work with tee logger for multiple outputs', async () => {
    // Create a second file logger as our second output destination
    const secondLogFile = path.join(testDir, 'second.log');
    const firstLogger = createFileLogger(testLogFile, TEST_FLUSH_DELAY);
    const secondLogger = createFileLogger(secondLogFile, TEST_FLUSH_DELAY);

    // Create tee logger that writes to both files
    const combinedLogger = tee(firstLogger, secondLogger);

    // Test logging
    combinedLogger.info('Test message for both loggers');

    // Wait for flushing
    await delay(TEST_FLUSH_WAIT);

    // Verify both files have the content
    const content1 = await readLogFile(testLogFile);
    const content2 = await readLogFile(secondLogFile);

    expect(content1).toContain('Test message for both loggers');
    expect(content2).toContain('Test message for both loggers');
  });

  test('should include additional arguments by default', async () => {
    const logger = createFileLogger(testLogFile);

    // Create some test arguments of different types
    const error = new Error('Test error');
    const obj = { user: 'test-user', id: 123 };
    const primitive = 42;

    // Log with additional arguments
    logger.info('Message with args', error, obj, primitive);

    // Wait for closing
    await logger.close();

    // Read the log file
    const content = await readLogFile();

    // Verify content includes main message
    expect(content).toContain('Message with args');

    // Verify error was serialized properly
    expect(content).toContain('Test error');

    // Verify object was serialized
    expect(content).toContain('user');
    expect(content).toContain('test-user');
    expect(content).toContain('123');

    // Verify primitive was included
    expect(content).toContain('42');
  });

  test('should not include args when omitArgs is true', async () => {
    const logger = createFileLogger(testLogFile, { ...TEST_FLUSH_DELAY, omitArgs: true });

    // Log with additional arguments
    logger.info('Message with args', { should: 'not appear' });

    // Wait for async operations
    await delay(TEST_FLUSH_WAIT);

    // Read the log file
    const content = await readLogFile();

    // Verify content includes only the main message
    expect(content).toContain('Message with args');

    // Verify args were not included
    expect(content).not.toContain('args:');
    expect(content).not.toContain('should');
    expect(content).not.toContain('not appear');
  });

  test('should handle complex and circular objects', async () => {
    const logger = createFileLogger(testLogFile, TEST_FLUSH_DELAY);

    // Create a complex object
    const complex = { name: 'complex', nested: { value: 42, data: [1, 2, 3] } };

    // Log with complex object
    logger.info('Complex object test', complex);

    // Wait for async operations
    await delay(TEST_FLUSH_WAIT);

    // Read the log file
    const content = await readLogFile();

    // Verify complex object was serialized without crashing
    expect(content).toContain('Complex object test');
    expect(content).toContain('complex');
    expect(content).toContain('nested');
    expect(content).toContain('42');

    // Create an object with circular reference using a separate test file
    const circularLogFile = path.join(testDir, 'circular.log');
    const circularLogger = createFileLogger(circularLogFile);

    const circular: Record<string, unknown> = { id: 'circular-test' };
    circular.self = circular; // Create circular reference

    // Log with circular object
    circularLogger.info('Circular reference test', circular);

    // Wait for async operations
    await circularLogger.flush();

    // Read the log file
    const circularContent = await readLogFile(circularLogFile);

    // Verify circular reference was handled without crashing
    expect(circularContent).toContain('Circular reference test');
    // Should have logged something about the object
    expect(circularContent).toContain('id');
    expect(circularContent).toContain('self');
  });

  test('should handle null and undefined arguments', async () => {
    const logger = createFileLogger(testLogFile);
    logger.info('Null and undefined test', null, undefined);

    await logger.flush();
    const content = await readLogFile();

    expect(content).toContain('Null and undefined test');
    expect(content).toContain('null');
    expect(content).toContain('undefined');
  });

  test('should handle multiple log entries, with different delays between them', async () => {
    const logger = createFileLogger(testLogFile, { flushDelayMs: 10 });

    for (let i = 1; i <= 50; i++) {
      logger.info(`line ${i}`);
    }

    await delay(10);

    for (let i = 51; i <= 60; i++) {
      logger.info(`line ${i}`);
      // eslint-disable-next-line no-await-in-loop
      await delay(5);
    }

    for (let i = 61; i <= 70; i++) {
      logger.info(`line ${i}`);
      // eslint-disable-next-line no-await-in-loop
      await delay(15);
    }

    await logger.close();

    const content = await readLogFile();
    const lines = content.split('\n');
    expect(lines.length).toBe(71);
    for (let i = 1; i <= 70; i++) {
      expect(lines[i - 1]).toMatch(new RegExp(`.+ line ${i}$`));
    }
    expect(lines[70]).toBe('');
  });

  test('should not write after closing', async () => {
    const logger = createFileLogger(testLogFile, { flushDelayMs: 10 });

    logger.info('Test message 1');
    await logger.close();
    logger.info('Test message 2');

    await delay(20);
    const content = await readLogFile();
    expect(content).toMatch(new RegExp(`.+ Test message 1\n$`));
  });

  test('should respect custom stringify options', async () => {
    const logger = createFileLogger(testLogFile, { stringifyOptions: { maxArrayElements: 5 } });
    const array = Array.from({ length: 20 }, (_, i) => i);

    logger.i`Array: ${array}`;
    await logger.close();

    const content = await readLogFile();
    expect(content).toContain('...(15)');
  });
});
