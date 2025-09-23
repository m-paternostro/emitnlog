import { describe, expect, test } from '@jest/globals';

import { ClosedError } from '../../../src/utils/index.ts';

describe('emitnlog.utils.closed-error', () => {
  test('should pass instanceOf checks', () => {
    const error = new ClosedError();
    expect(error).toBeInstanceOf(ClosedError);
    expect(error).toBeInstanceOf(Error);
  });

  test('should have the correct name', () => {
    const error = new ClosedError();
    expect(error.name).toBe('ClosedError');
  });
});
