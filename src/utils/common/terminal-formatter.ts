/**
 * Object containing methods for terminal text formatting.
 */
export const terminalFormatter = {
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
  dim: (text: string): string => text && `\x1b[0m\x1b[2m${text}\x1b[0m`,

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
  cyan: (text: string): string => text && `\x1b[0m\x1b[36m${text}\x1b[0m`,

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
  green: (text: string): string => text && `\x1b[0m\x1b[32m${text}\x1b[0m`,

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
  yellow: (text: string): string => text && `\x1b[0m\x1b[33m${text}\x1b[0m`,

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
  red: (text: string): string => text && `\x1b[0m\x1b[31m${text}\x1b[0m`,

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
  magenta: (text: string): string => text && `\x1b[0m\x1b[35m${text}\x1b[0m`,

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
  boldRed: (text: string): string => text && `\x1b[0m\x1b[1;31m${text}\x1b[0m`,

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
  redBackground: (text: string): string => text && `\x1b[0m\x1b[41;37m${text}\x1b[0m`,
} as const;
