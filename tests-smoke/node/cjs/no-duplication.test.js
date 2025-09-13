const { OFF_LOGGER } = require('emitnlog/logger');
const { CanceledError, emptyArray } = require('emitnlog/utils');
const { CanceledError: CanceledError_FromMain, OFF_LOGGER: OFF_LOGGER_FROM_MAIN } = require('emitnlog');

const utils = require('emitnlog').utils;

const logger = require('emitnlog/logger');
const notifier = require('emitnlog/notifier');
const tracker = require('emitnlog/tracker');

describe('CJS No duplication - shared instances', () => {
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
