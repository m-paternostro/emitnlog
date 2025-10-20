import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { OFF_LOGGER, withLogger } from '../../src/logger/index.ts';
import { createMemoryLogger } from '../vitest.setup.ts';

describe('emitnlog.logger.off-logger', () => {
  let consoleLogSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should not log any messages', () => {
    OFF_LOGGER.trace('trace message');
    OFF_LOGGER.t`trace message`;
    OFF_LOGGER.debug('debug message');
    OFF_LOGGER.d`test message`;
    OFF_LOGGER.info('info message');
    OFF_LOGGER.i`test message`;
    OFF_LOGGER.notice('notice message');
    OFF_LOGGER.n`test message`;
    OFF_LOGGER.warning('warning message');
    OFF_LOGGER.w`test message`;
    OFF_LOGGER.error('error message');
    OFF_LOGGER.e`test message`;
    OFF_LOGGER.critical('critical message');
    OFF_LOGGER.c`test message`;
    OFF_LOGGER.alert('alert message');
    OFF_LOGGER.a`test message`;
    OFF_LOGGER.emergency('emergency message');
    OFF_LOGGER.em`test message`;
    OFF_LOGGER.log('error', 'error message');
    OFF_LOGGER.args({ data: 'test' }).e`Should not log`;
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  test('withLogger should return OFF_LOGGER if the logger is undefined', () => {
    expect(withLogger(undefined)).toBe(OFF_LOGGER);
    expect(withLogger(null)).toBe(OFF_LOGGER);

    const logger = createMemoryLogger();
    expect(withLogger(logger)).toBe(logger);
  });
});
