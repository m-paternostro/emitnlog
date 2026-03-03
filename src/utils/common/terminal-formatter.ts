/**
 * Object containing methods for terminal text formatting.
 */
export const terminalFormatter = {
  /**
   * Checks if color is enabled.
   *
   * Colors are suppressed when the `process` global value is defined and any of these conditions is true:
   *
   * - The NO_COLOR environment variable is set,
   * - When FORCE_COLOR=0 is set.
   * - When stdout is not a TTY (e.g. piped to a file or CI with no terminal), unless FORCE_COLOR is set to a non-zero
   *   value.
   *
   * @returns True if color is enabled, false otherwise.
   */
  isColorEnabled: (): boolean => isTerminalColorEnabled(),

  /**
   * Indents text with spaces.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   *
   * terminalFormatter.indent('Hello'); // '    Hello'
   * terminalFormatter.indent('World', 2); // '        World'
   * terminalFormatter.indent('Code', 1, 2); // '  Code'
   * ```
   *
   * @param text The text to indent
   * @param counter Number of indentation levels (default 1)
   * @param length Number of spaces per indentation level (default 4)
   * @returns The indented text
   */
  indent: (text: string, counter = 1, length = 4): string => `${' '.repeat(counter * length)}${text}`,

  /**
   * Outputs a dimmed text, typically used for subtle, low visibility information.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.dim('debug info'); // Returns dimmed text
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered as a dimmed text on a terminal
   */
  dim: (text: string): string => (!text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[2m${text}\x1b[0m`),

  /**
   * Formats text in cyan, typically used for informational messages.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.cyan('INFO: Server started'); // Returns cyan-colored text
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered as cyan text on a terminal
   */
  cyan: (text: string): string => (!text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[36m${text}\x1b[0m`),

  /**
   * Formats text in green, typically used for positive or noticeable but not alarming messages.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.green('✓ Tests passed'); // Returns green-colored text
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered as green text on a terminal
   */
  green: (text: string): string => (!text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[32m${text}\x1b[0m`),

  /**
   * Formats text in yellow, typically used for cautionary or warning messages.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.yellow('⚠ Deprecation warning'); // Returns yellow-colored text
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered as yellow text on a terminal
   */
  yellow: (text: string): string => (!text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[33m${text}\x1b[0m`),

  /**
   * Formats text in red, typically used to indicate problems or errors.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.red('Error: File not found'); // Returns red-colored text
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered as red text on a terminal
   */
  red: (text: string): string => (!text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[31m${text}\x1b[0m`),

  /**
   * Formats text in magenta, typically used for critical or serious issues.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.magenta('CRITICAL: Database connection lost'); // Returns magenta-colored text
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered as magenta text on a terminal
   */
  magenta: (text: string): string => (!text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[35m${text}\x1b[0m`),

  /**
   * Formats text in bold red, typically used for alerts or very serious issues.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.boldRed('ALERT: Security breach detected'); // Returns bold red text
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered as bold red text on a terminal
   */
  boldRed: (text: string): string => (!text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[1;31m${text}\x1b[0m`),

  /**
   * Formats text with a red background, typically used for emergency or highest severity messages.
   *
   * @example
   *
   * ```ts
   * import { terminalFormatter } from 'emitnlog/utils';
   * terminalFormatter.redBackground('EMERGENCY: System failure'); // Returns text with red background
   * ```
   *
   * @param text
   * @returns A string formatted to be rendered with red background and white text on a terminal
   */
  redBackground: (text: string): string =>
    !text || !isTerminalColorEnabled() ? text : `\x1b[0m\x1b[41;37m${text}\x1b[0m`,
} as const;

let colorEnabled: boolean | undefined;
const isTerminalColorEnabled = (): boolean => {
  if (colorEnabled === undefined) {
    const checkColorEnabled = (): boolean => {
      // eslint-disable-next-line no-undef
      const localProcess = process as unknown;
      if (localProcess && typeof localProcess === 'object' && 'env' in localProcess && 'stdout' in localProcess) {
        const { env, stdout } = localProcess as {
          readonly env?: Record<string, string | undefined>;
          readonly stdout?: { readonly isTTY?: unknown };
        };

        if (env?.NO_COLOR || env?.FORCE_COLOR === '0') {
          return false;
        }

        if (!env?.FORCE_COLOR && stdout?.isTTY !== true) {
          return false;
        }
      }

      return true;
    };
    colorEnabled = checkColorEnabled();
  }
  return colorEnabled;
};
