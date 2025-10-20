import { describe, expect, test } from 'vitest';

import { terminalFormatter } from '../../../src/utils/index.ts';

describe('emitnlog.utils.terminalFormatter', () => {
  describe('color formatters', () => {
    const colorFormatterKeys = (Object.keys(terminalFormatter) as (keyof typeof terminalFormatter)[]).filter(
      (key): key is Exclude<keyof typeof terminalFormatter, 'indent'> => key !== 'indent',
    );

    test('returns reset-wrapped text for color formatters', () => {
      colorFormatterKeys.forEach((key) => {
        const formatted = terminalFormatter[key]('value');

        expect(formatted.startsWith('\x1b[0m')).toBe(true);
        expect(formatted.endsWith('\x1b[0m')).toBe(true);
        expect(formatted).toContain('value');
      });
    });

    test('returns an empty string when formatter input is empty', () => {
      colorFormatterKeys.forEach((key) => {
        expect(terminalFormatter[key]('')).toBe('');
      });
    });
  });

  describe('indent formatter', () => {
    test('indents text using the expected defaults', () => {
      expect(terminalFormatter.indent('text')).toBe('    text');
      expect(terminalFormatter.indent('text', 2)).toBe('        text');
    });

    test('indents text using custom length', () => {
      expect(terminalFormatter.indent('text', 3, 2)).toBe('      text');
      expect(terminalFormatter.indent('text', 0, 4)).toBe('text');
    });
  });
});
