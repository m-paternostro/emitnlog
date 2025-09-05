import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { LogLevel, LogMessage } from '../../src/logger/index.ts';
import {
  appendPrefix,
  createConsoleByLevelLogger,
  createConsoleErrorLogger,
  createConsoleLogLogger,
  emitter,
  tee,
  withPrefix,
} from '../../src/logger/index.ts';

describe('emitnlog.logger.lazy-evaluation', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => void 0);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => void 0);
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => void 0);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('should evaluate the message lazily', () => {
    const createLogger = (level: LogLevel) => [
      /* 00 */ createConsoleLogLogger(level),
      /* 01 */ createConsoleErrorLogger(level),
      /* 02 */ createConsoleByLevelLogger(level),
      /* 03 */ emitter.createLogger(level, emitter.memorySink()),
      /* 04 */ withPrefix(createConsoleLogLogger(level), 'test'),
      /* 05 */ appendPrefix(withPrefix(createConsoleLogLogger(level), 'test'), '2'),
      /* 06 */ tee(emitter.createLogger(level, emitter.memorySink()), createConsoleLogLogger(level)),
    ];

    const createCountingMessage = (): { readonly message: LogMessage; readonly count: number } => {
      let invocationCount = 0;
      const message: LogMessage = () => {
        invocationCount++;
        return 'Test message';
      };

      return {
        message,
        get count() {
          return invocationCount;
        },
      };
    };

    describe('debug message with debug loggers', () => {
      const loggers = createLogger('debug');

      describe('traditional method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.debug(counting.message);
            expect(counting.count).toBe(1);
          });
        });
      });

      describe('template method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.d`test${counting.message}`;
            expect(counting.count).toBe(1);
          });
        });
      });
    });

    describe('debug message with info loggers', () => {
      const loggers = createLogger('info');

      describe('traditional method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.debug(counting.message);
            expect(counting.count).toBe(0);
          });
        });
      });

      describe('template method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.d`test${counting.message}`;
            expect(counting.count).toBe(0);
          });
        });
      });
    });

    describe('error message with info loggers', () => {
      const loggers = createLogger('info');

      describe('traditional method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.error(counting.message);
            expect(counting.count).toBe(1);
          });
        });
      });

      describe('template method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.e`test${counting.message}`;
            expect(counting.count).toBe(1);
          });
        });
      });
    });

    describe('error message with error loggers', () => {
      const loggers = createLogger('error');

      describe('traditional method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.error(counting.message);
            expect(counting.count).toBe(1);
          });
        });
      });

      describe('template method', () => {
        loggers.forEach((logger, index) => {
          test(`logger index:${index}`, () => {
            const counting = createCountingMessage();
            logger.e`test${counting.message}`;
            expect(counting.count).toBe(1);
          });
        });
      });
    });
  });
});
