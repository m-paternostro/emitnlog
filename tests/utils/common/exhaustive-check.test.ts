import { describe, expect, test } from '@jest/globals';

import { exhaustiveCheck } from '../../../src/utils/index.ts';

describe('emitnlog.utils.exhaustiveCheck', () => {
  test('should not have side effects', () => {
    let gotHere = false;

    type COLOR = 'red' | 'green' | 'blue';
    const color = 'yellow' as COLOR;
    switch (color) {
      case 'red':
      case 'green':
      case 'blue':
        throw new Error('This should not happen');

      default:
        exhaustiveCheck(color);
        gotHere = true;
    }

    expect(gotHere).toBe(true);
  });
});
