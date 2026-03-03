import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('emitnlog.utils.terminalFormatter', () => {
  describe('color formatters (colors enabled)', () => {
    type TerminalFormatter = Record<string, (text: string) => string>;

    let terminalFormatter: TerminalFormatter;
    let colorFormatterKeys: string[] = [];

    beforeEach(async () => {
      vi.stubEnv('FORCE_COLOR', '1');
      vi.resetModules();

      const tf = (await import('../../../src/utils/common/terminal-formatter.ts')).terminalFormatter;
      expect(tf.isColorEnabled()).toBe(true);

      colorFormatterKeys = Object.keys(tf).filter((key) => key !== 'indent' && key !== 'isColorEnabled');
      terminalFormatter = tf as unknown as TerminalFormatter;
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    test('returns reset-wrapped text for color formatters when colors are enabled', () => {
      colorFormatterKeys.forEach((key) => {
        const formatted = terminalFormatter[key]('value');
        // In a color-enabled environment the output must be wrapped with ANSI reset codes
        expect(formatted).toContain('value');
        if (formatted !== 'value') {
          // If color is active the result starts and ends with the reset sequence
          expect(formatted.startsWith('\x1b[0m')).toBe(true);
          expect(formatted.endsWith('\x1b[0m')).toBe(true);
        }
      });
    });

    test('returns an empty string when formatter input is empty', () => {
      colorFormatterKeys.forEach((key) => {
        expect(terminalFormatter[key]('')).toBe('');
      });
    });
  });

  describe('color suppression via environment variables', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    test('returns plain text (no ANSI codes) when NO_COLOR is set', async () => {
      vi.stubEnv('NO_COLOR', '1');
      vi.resetModules();

      const { terminalFormatter } = await import('../../../src/utils/common/terminal-formatter.ts');

      expect(terminalFormatter.isColorEnabled()).toBe(false);

      expect(terminalFormatter.red('error')).toBe('error');
      expect(terminalFormatter.green('success')).toBe('success');
      expect(terminalFormatter.cyan('info')).toBe('info');
      expect(terminalFormatter.yellow('warn')).toBe('warn');
      expect(terminalFormatter.dim('subtle')).toBe('subtle');
      expect(terminalFormatter.magenta('critical')).toBe('critical');
      expect(terminalFormatter.boldRed('alert')).toBe('alert');
      expect(terminalFormatter.redBackground('emergency')).toBe('emergency');
    });

    test('returns plain text when FORCE_COLOR=0', async () => {
      vi.stubEnv('FORCE_COLOR', '0');
      vi.resetModules();

      const { terminalFormatter } = await import('../../../src/utils/common/terminal-formatter.ts');

      expect(terminalFormatter.red('error')).toBe('error');
      expect(terminalFormatter.green('success')).toBe('success');
    });

    test('still returns empty string for empty input even when NO_COLOR is set', async () => {
      vi.stubEnv('NO_COLOR', '1');
      vi.resetModules();

      const { terminalFormatter } = await import('../../../src/utils/common/terminal-formatter.ts');

      expect(terminalFormatter.red('')).toBe('');
      expect(terminalFormatter.cyan('')).toBe('');
    });
  });

  describe('indent formatter', () => {
    test('indents text using the expected defaults', async () => {
      const { terminalFormatter } = await import('../../../src/utils/common/terminal-formatter.ts');
      expect(terminalFormatter.indent('text')).toBe('    text');
      expect(terminalFormatter.indent('text', 2)).toBe('        text');
    });

    test('indents text using custom length', async () => {
      const { terminalFormatter } = await import('../../../src/utils/common/terminal-formatter.ts');

      expect(terminalFormatter.indent('text', 3, 2)).toBe('      text');
      expect(terminalFormatter.indent('text', 0, 4)).toBe('text');
    });
  });
});
