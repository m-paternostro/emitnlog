import { describe, expect, test } from 'vitest';

import { CanceledError } from '../../../src/utils/index.ts';

describe('emitnlog.utils.canceled-error', () => {
  test('should pass instanceOf checks', () => {
    const error = new CanceledError();
    expect(error).toBeInstanceOf(CanceledError);
    expect(error).toBeInstanceOf(Error);
  });

  test('should have the correct name', () => {
    const error = new CanceledError();
    expect(error.name).toBe('CanceledError');
  });
});
