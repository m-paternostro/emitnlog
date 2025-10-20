import { OFF_LOGGER } from 'emitnlog/logger';
import { CanceledError, emptyArray } from 'emitnlog/utils';
import { CanceledError as CanceledError_FromMain, OFF_LOGGER as OFF_LOGGER_FROM_MAIN } from 'emitnlog';
import * as logger from 'emitnlog/notifier';
import * as notifier from 'emitnlog/notifier';
import * as tracker from 'emitnlog/tracker';

import { utils } from 'emitnlog';

import { expect, test, describe } from 'vitest';

describe('ESM No duplication - shared instances', () => {
  test('OFF_LOGGER is the same instance across all imports', () => {
    expect(OFF_LOGGER).toBe(OFF_LOGGER_FROM_MAIN);

    expect(notifier.OFF_LOGGER).toBeUndefined();
    expect(tracker.OFF_LOGGER).toBeUndefined();
  });

  test('emptyArray is the same instance across all imports', () => {
    expect(emptyArray).toBe(utils.emptyArray);

    expect(logger.emptyArray).toBeUndefined();
    expect(notifier.emptyArray).toBeUndefined();
    expect(tracker.emptyArray).toBeUndefined();
  });

  test('CanceledError is the same class across all imports', () => {
    const error = new CanceledError();
    expect(error instanceof CanceledError_FromMain).toBe(true);

    expect(logger.CanceledError).toBeUndefined();
    expect(notifier.CanceledError).toBeUndefined();
    expect(tracker.CanceledError).toBeUndefined();
  });
});
