import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { LogLevel } from '../../src/logger/index.ts';
import { BaseLogger } from '../../src/logger/index.ts';

describe('emitnlog.logger.BaseLogger', () => {
  class TestLogger extends BaseLogger {
    public readonly emittedLines: {
      readonly level: LogLevel;
      readonly message: string;
      readonly args: readonly unknown[];
    }[] = [];

    protected emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
      this.emittedLines.push({ level, message, args });
    }
  }

  describe('constructor', () => {
    test('should set the level to info if no level is provided', () => {
      expect(new TestLogger().level).toBe('info');
    });

    test('should set the level to trace', () => {
      expect(new TestLogger('trace').level).toBe('trace');
    });

    test('should set the level to debug', () => {
      expect(new TestLogger('debug').level).toBe('debug');
    });

    test('should set the level to info', () => {
      expect(new TestLogger('info').level).toBe('info');
    });

    test('should set the level to notice', () => {
      expect(new TestLogger('notice').level).toBe('notice');
    });

    test('should set the level to warning', () => {
      expect(new TestLogger('warning').level).toBe('warning');
    });

    test('should set the level to error', () => {
      expect(new TestLogger('error').level).toBe('error');
    });

    test('should set the level to critical', () => {
      expect(new TestLogger('critical').level).toBe('critical');
    });

    test('should set the level to alert', () => {
      expect(new TestLogger('alert').level).toBe('alert');
    });

    test('should set the level to emergency', () => {
      expect(new TestLogger('emergency').level).toBe('emergency');
    });
  });

  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger('trace');
  });

  describe('Basic Logging', () => {
    test('should log trace messages', () => {
      logger.trace('trace message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('trace');
      expect(logger.emittedLines[0].message).toBe('trace message');
    });

    test('should log debug messages', () => {
      logger.debug('debug message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('debug');
      expect(logger.emittedLines[0].message).toBe('debug message');
    });

    test('should log info messages', () => {
      logger.info('info message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('info');
      expect(logger.emittedLines[0].message).toBe('info message');
    });

    test('should log notice messages', () => {
      logger.notice('notice message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('notice');
      expect(logger.emittedLines[0].message).toBe('notice message');
    });

    test('should log warning messages', () => {
      logger.warning('warning message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('warning');
      expect(logger.emittedLines[0].message).toBe('warning message');
    });

    test('should log error messages', () => {
      logger.error('error message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toBe('error message');
    });

    test('should log critical messages', () => {
      logger.critical('critical message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('critical');
      expect(logger.emittedLines[0].message).toBe('critical message');
    });

    test('should log alert messages', () => {
      logger.alert('alert message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('alert');
      expect(logger.emittedLines[0].message).toBe('alert message');
    });

    test('should log emergency messages', () => {
      logger.emergency('emergency message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('emergency');
      expect(logger.emittedLines[0].message).toBe('emergency message');
    });

    test('should log an error object', () => {
      const error = new Error('error message');
      logger.error(error);
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toBe('error message');
      expect(logger.emittedLines[0].args).toContain(error);
    });

    test('should log an object with message property', () => {
      const object = { message: 'error message' };
      logger.error(object);
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toBe('{"message":"error message"}');
      expect(logger.emittedLines[0].args).toContain(object);
    });

    test('should log an object with error property', () => {
      const object = { error: new Error('error message') };
      logger.error(object);
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toBe('error message');
      expect(logger.emittedLines[0].args).toContain(object);
    });
  });

  describe('Log level filtering', () => {
    test('should not log if level is set to off', () => {
      logger.level = 'off';
      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.notice('notice message');
      logger.warning('warning message');
      logger.error('error message');
      logger.critical('critical message');
      logger.alert('alert message');
      logger.emergency('emergency message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log trace messages if level is set to debug', () => {
      logger.level = 'debug';
      logger.trace('trace message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log debug messages if level is set to info', () => {
      logger.level = 'info';
      logger.debug('debug message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log info messages if level is set to notice', () => {
      logger.level = 'notice';
      logger.info('info message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log notice messages if level is set to warning', () => {
      logger.level = 'warning';
      logger.notice('notice message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log warning messages if level is set to error', () => {
      logger.level = 'error';
      logger.warning('warning message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log error messages if level is set to critical', () => {
      logger.level = 'critical';
      logger.error('error message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log critical messages if level is set to alert', () => {
      logger.level = 'alert';
      logger.critical('critical message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should not log alert messages if level is set to emergency', () => {
      logger.level = 'emergency';
      logger.alert('alert message');
      expect(logger.emittedLines).toHaveLength(0);
    });

    test('should log emergency messages at all levels except off', () => {
      logger.level = 'emergency';
      logger.emergency('emergency message');
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('emergency');
      expect(logger.emittedLines[0].message).toBe('emergency message');
    });
  });

  describe('Deferred message execution', () => {
    test('should not execute function message if log level is not applicable', () => {
      logger.level = 'debug';
      const messageFunction = jest.fn(() => 'expensive trace message');
      logger.trace(messageFunction);
      expect(messageFunction).not.toHaveBeenCalled();
    });

    test('should execute function message if log level is applicable', () => {
      logger.level = 'info';
      const messageFunction = jest.fn(() => 'expensive message');
      logger.info(messageFunction);
      expect(messageFunction).toHaveBeenCalled();
    });

    test('should handle lazy message functions', () => {
      logger.level = 'info';

      let count = 0;
      const expensiveOperation = () => {
        count++;
        return 'result';
      };

      expect(logger.emittedLines).toEqual([]);
      expect(count).toBe(0);
      //
      logger.info(() => `Computed: ${String(expensiveOperation())}`);
      logger.debug(() => `Computed: ${String(expensiveOperation())}`);
      logger.warning(() => `Computed: ${String(expensiveOperation())}`);
      //
      expect(logger.emittedLines[0].level).toBe('info');
      expect(logger.emittedLines[0].message).toBe('Computed: result');
      expect(logger.emittedLines[1].level).toBe('warning');
      expect(logger.emittedLines[1].message).toBe('Computed: result');
      expect(count).toBe(2);
    });
  });

  describe('Template literal logging', () => {
    const fail = () => {
      throw new Error('should not be called');
    };

    describe('trace', () => {
      test('should log trace messages using template literals', () => {
        logger.level = 'trace';
        logger.t`test trace message with a number ${42} and a delayed value ${() => 'very detailed'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('trace');
        expect(logger.emittedLines[0].message).toBe(
          'test trace message with a number 42 and a delayed value very detailed',
        );
      });

      test('should not compute the log template if level is set to debug', () => {
        logger.level = 'debug';
        logger.t`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('debug', () => {
      test('should log debug messages using template literals', () => {
        logger.level = 'debug';
        logger.d`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('debug');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to info', () => {
        logger.level = 'info';
        logger.d`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('info', () => {
      test('should log info messages using template literals', () => {
        logger.level = 'info';
        logger.i`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('info');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to notice', () => {
        logger.level = 'notice';
        logger.i`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('notice', () => {
      test('should log notice messages using template literals', () => {
        logger.level = 'notice';
        logger.n`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('notice');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to warning', () => {
        logger.level = 'warning';
        logger.n`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('warning', () => {
      test('should log warning messages using template literals', () => {
        logger.level = 'warning';
        logger.w`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('warning');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to error', () => {
        logger.level = 'error';
        logger.w`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('error', () => {
      test('should log error messages using template literals', () => {
        logger.level = 'error';
        logger.e`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('error');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to critical', () => {
        logger.level = 'critical';
        logger.e`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('critical', () => {
      test('should log critical messages using template literals', () => {
        logger.level = 'critical';
        logger.c`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('critical');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to alert', () => {
        logger.level = 'alert';
        logger.c`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('alert', () => {
      test('should log alert messages using template literals', () => {
        logger.level = 'alert';
        logger.a`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('alert');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to emergency', () => {
        logger.level = 'emergency';
        logger.a`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('emergency', () => {
      test('should log emergency messages using template literals', () => {
        logger.level = 'emergency';
        logger.em`test message with a number ${42} and a delayed value ${() => 'very cool'}`;
        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('emergency');
        expect(logger.emittedLines[0].message).toBe('test message with a number 42 and a delayed value very cool');
      });

      test('should not compute the log template if level is set to off', () => {
        logger.level = 'off';
        logger.em`test message with a number ${42} and a delayed value ${() => fail()}`;
        expect(logger.emittedLines).toHaveLength(0);
      });
    });

    describe('Error handling in template literals', () => {
      test('should automatically format Error objects in template literals', () => {
        const error = new Error('Connection failed');
        logger.e`Database error: ${error}`;

        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('error');
        expect(logger.emittedLines[0].message).toBe('Database error: Connection failed');
      });

      test('should automatically format objects with message property in template literals', () => {
        const customError = { message: 'Custom error message' };
        logger.e`Application error: ${customError}`;

        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('error');
        expect(logger.emittedLines[0].message).toBe('Application error: {"message":"Custom error message"}');
      });

      test('should handle both error objects in templates and as args', () => {
        const error1 = new Error('First error');
        const error2 = new Error('Second error');

        logger.args(error2).e`Primary error: ${error1}, with context`;

        expect(logger.emittedLines).toHaveLength(1);
        expect(logger.emittedLines[0].level).toBe('error');
        expect(logger.emittedLines[0].message).toBe('Primary error: First error, with context');
        expect(logger.emittedLines[0].args).toContain(error2);
      });

      test('should format errors at all log levels', () => {
        const error = new Error('Test error');

        logger.d`Debug with error: ${error}`;
        logger.i`Info with error: ${error}`;
        logger.n`Notice with error: ${error}`;
        logger.w`Warning with error: ${error}`;
        logger.e`Error with error: ${error}`;
        logger.c`Critical with error: ${error}`;
        logger.a`Alert with error: ${error}`;
        logger.em`Emergency with error: ${error}`;

        expect(logger.emittedLines).toHaveLength(8);
        expect(logger.emittedLines[0].level).toBe('debug');
        expect(logger.emittedLines[0].message).toBe('Debug with error: Test error');
        expect(logger.emittedLines[1].level).toBe('info');
        expect(logger.emittedLines[1].message).toBe('Info with error: Test error');
        expect(logger.emittedLines[2].level).toBe('notice');
        expect(logger.emittedLines[2].message).toBe('Notice with error: Test error');
        expect(logger.emittedLines[3].level).toBe('warning');
        expect(logger.emittedLines[3].message).toBe('Warning with error: Test error');
        expect(logger.emittedLines[4].level).toBe('error');
        expect(logger.emittedLines[4].message).toBe('Error with error: Test error');
        expect(logger.emittedLines[5].level).toBe('critical');
        expect(logger.emittedLines[5].message).toBe('Critical with error: Test error');
        expect(logger.emittedLines[6].level).toBe('alert');
        expect(logger.emittedLines[6].message).toBe('Alert with error: Test error');
        expect(logger.emittedLines[7].level).toBe('emergency');
        expect(logger.emittedLines[7].message).toBe('Emergency with error: Test error');
      });
    });

    test('should handle lazy message stringification', () => {
      logger.level = 'info';

      let count = 0;
      const expensiveStringification = {
        toString() {
          count++;
          return 'result';
        },
      };

      expect(logger.emittedLines).toEqual([]);
      expect(count).toBe(0);
      //
      logger.i`Computed: ${expensiveStringification}`;
      logger.d`Computed: ${expensiveStringification}`;
      logger.w`Computed: ${expensiveStringification}`;
      //
      expect(logger.emittedLines[0].level).toBe('info');
      expect(logger.emittedLines[0].message).toBe('Computed: result');
      expect(logger.emittedLines[1].level).toBe('warning');
      expect(logger.emittedLines[1].message).toBe('Computed: result');
      expect(count).toBe(2);
    });

    test('should handle encoded characters in template literals', () => {
      logger.level = 'info';

      const value = '\nworld';
      logger.i`hello\n\t${value}`;

      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('info');

      const actual = logger.emittedLines[0].message;
      expect(actual).toBe(`hello\n\t\nworld`);
    });

    test('should respect raw encoded characters in template literals', () => {
      logger.level = 'info';

      const array = ['hello\\n\\t', ''];
      (array as unknown as Record<string, string[]>).raw = ['hello\\n\\t', ''];

      const value = '\\nworld';
      logger.i(array as unknown as TemplateStringsArray, value);

      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('info');

      const actual = logger.emittedLines[0].message;
      expect(actual).toBe(`hello\\n\\t\\nworld`);
    });
  });

  describe('args() method', () => {
    beforeEach(() => {
      logger = new TestLogger('debug');
    });

    test('should include additional args with template literals', () => {
      const error = new Error('details');
      logger.args(error).e`Failed operation`;
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toBe('Failed operation');
      expect(logger.emittedLines[0].args).toContain(error);
    });

    test('should include multiple args with template literals', () => {
      const user = { id: 123, name: 'Test User' };
      const requestId = 'req-456';
      logger.args(user, requestId).i`User login`;
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('info');
      expect(logger.emittedLines[0].message).toBe('User login');
      expect(logger.emittedLines[0].args).toContain(user);
      expect(logger.emittedLines[0].args).toContain(requestId);
    });

    test('should include args with traditional (non-template) logging methods', () => {
      // Test with traditional methods
      const context = { requestId: 'abc-123' };
      logger.args(context).info('Info message with context');

      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('info');
      expect(logger.emittedLines[0].message).toBe('Info message with context');
      expect(logger.emittedLines[0].args).toContainEqual(context);

      // Clear for next test
      logger.emittedLines.length = 0;

      // Test with error method which has special handling
      const error = new Error('System failure');
      const metadata = { timestamp: Date.now() };
      logger.args(metadata).error(error);

      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toBe('System failure');
      expect(logger.emittedLines[0].args).toContain(error);
      expect(logger.emittedLines[0].args).toContain(metadata);
    });

    test('should clear args after they are used', () => {
      const firstArg = { id: 1 };
      const secondArg = { id: 2 };

      logger.args(firstArg).d`First log`;
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('debug');
      expect(logger.emittedLines[0].message).toBe('First log');
      expect(logger.emittedLines[0].args).toContain(firstArg);

      logger.d`Second log`;
      expect(logger.emittedLines).toHaveLength(2);
      expect(logger.emittedLines[1].level).toBe('debug');
      expect(logger.emittedLines[1].message).toBe('Second log');
      expect(logger.emittedLines[1].args).not.toContain(firstArg);

      logger.args(secondArg).d`Third log`;
      expect(logger.emittedLines).toHaveLength(3);
      expect(logger.emittedLines[2].level).toBe('debug');
      expect(logger.emittedLines[2].message).toBe('Third log');
      expect(logger.emittedLines[2].args).toContain(secondArg);
    });

    test('should reset args even when log level is not applicable', () => {
      logger.level = 'warning'; // Set level to warning (higher than debug/info)

      const context = { user: 'test-user' };

      // This shouldn't log because 'info' < 'warning'
      logger.args(context).info('This should not be logged');

      // Args should have been reset even though the log was filtered out
      expect(logger.emittedLines).toHaveLength(0);

      // Now log something at the appropriate level
      logger.warning('This should be logged');

      // Should log but without the previous context
      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('warning');
      expect(logger.emittedLines[0].message).toBe('This should be logged');
      expect(logger.emittedLines[0].args).not.toContain(context);
      expect(logger.emittedLines[0].args).toHaveLength(0);
    });

    test('should work with all log levels', () => {
      const context = { context: 'test' };

      logger.args(context).d`Debug log`;
      logger.args(context).i`Info log`;
      logger.args(context).n`Notice log`;
      logger.args(context).w`Warning log`;
      logger.args(context).e`Error log`;
      logger.args(context).c`Critical log`;
      logger.args(context).a`Alert log`;
      logger.args(context).em`Emergency log`;

      expect(logger.emittedLines).toHaveLength(8);

      expect(logger.emittedLines[0].level).toBe('debug');
      expect(logger.emittedLines[0].message).toBe('Debug log');
      expect(logger.emittedLines[0].args).toContain(context);

      expect(logger.emittedLines[1].level).toBe('info');
      expect(logger.emittedLines[1].message).toBe('Info log');
      expect(logger.emittedLines[1].args).toContain(context);

      expect(logger.emittedLines[2].level).toBe('notice');
      expect(logger.emittedLines[2].message).toBe('Notice log');
      expect(logger.emittedLines[2].args).toContain(context);

      expect(logger.emittedLines[3].level).toBe('warning');
      expect(logger.emittedLines[3].message).toBe('Warning log');
      expect(logger.emittedLines[3].args).toContain(context);

      expect(logger.emittedLines[4].level).toBe('error');
      expect(logger.emittedLines[4].message).toBe('Error log');
      expect(logger.emittedLines[4].args).toContain(context);

      expect(logger.emittedLines[5].level).toBe('critical');
      expect(logger.emittedLines[5].message).toBe('Critical log');
      expect(logger.emittedLines[5].args).toContain(context);

      expect(logger.emittedLines[6].level).toBe('alert');
      expect(logger.emittedLines[6].message).toBe('Alert log');
      expect(logger.emittedLines[6].args).toContain(context);

      expect(logger.emittedLines[7].level).toBe('emergency');
      expect(logger.emittedLines[7].message).toBe('Emergency log');
      expect(logger.emittedLines[7].args).toContain(context);
    });

    test('should respect log level filtering', () => {
      logger.level = 'error';
      const context = { context: 'test' };

      logger.args(context).d`Debug log`;
      logger.args(context).i`Info log`;
      logger.args(context).n`Notice log`;
      logger.args(context).w`Warning log`;
      logger.args(context).e`Error log`;

      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toBe('Error log');
      expect(logger.emittedLines[0].args).toContain(context);
    });

    test('should handle OFF_LOGGER correctly', () => {
      const offLogger = new TestLogger('off');
      const context = { context: 'test' };

      offLogger.args(context).d`This should not be logged`;
      offLogger.args(context).e`This should not be logged either`;

      expect(offLogger.emittedLines).toHaveLength(0);
    });

    test('should handle complex scenarios with error objects', () => {
      const error = new Error('Something went wrong');
      const requestContext = { userId: '123', requestId: 'abc-123', timestamp: new Date().toISOString() };

      logger.args(error, requestContext).e`Failed to process request at ${new Date().toISOString()}`;

      expect(logger.emittedLines).toHaveLength(1);
      expect(logger.emittedLines[0].level).toBe('error');
      expect(logger.emittedLines[0].message).toMatch(/Failed to process request at/);
      expect(logger.emittedLines[0].args).toContain(error);
      expect(logger.emittedLines[0].args).toContain(requestContext);
    });
  });
});
