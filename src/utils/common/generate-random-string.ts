import type { Writable } from 'type-fest';

type GenerateRandomString = ((length?: number) => string) & {
  /**
   * The crypto global, if available.
   */
  // eslint-disable-next-line no-undef
  readonly crypto?: typeof crypto;
};

/**
 * Generates a random string of the specified length using alphanumeric characters (i.e., "A-Z", "a-z" and "0-9").
 *
 * @example
 *
 * ```ts
 * import { generateRandomString } from 'emitnlog/utils';
 *
 * // Generate a random string with default length (8)
 * const id = generateRandomString();
 *
 * // Generate a random string with custom length
 * const longerId = generateRandomString(64);
 * ```
 *
 * @param length - Defaults to 8. Must be a number between 8 and 128.
 * @returns A random string of the specified length.
 * @throws An error if length is not in the range between 8 and 128 (inclusive).
 * @note NOT SUITABLE FOR CRYPTOGRAPHIC OR SECURITY-CRITICAL PURPOSES.
 * For security-sensitive applications, use a cryptographically secure random generator instead -
 * `generateRandomString.crypto` is defined if your environment supports the `crypto` global. Even when `crypto` is
 * available, the output is not uniformly random due to character mapping; do not use for security.
 */
export const generateRandomString: GenerateRandomString = (length = 8) => {
  if (length < 8 || length > 128) {
    throw new Error('IllegalArgument: length must be a number between 8 and 128');
  }

  const localCrypto = generateRandomString.crypto;
  if (localCrypto) {
    const bytes = new Uint8Array(length);
    localCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => UNIQUE_CHARACTERS[byte % UNIQUE_CHARACTERS.length]).join('');
  }

  return Array.from({ length }, () => {
    const randomIndex = Math.floor(Math.random() * UNIQUE_CHARACTERS.length);
    return UNIQUE_CHARACTERS.charAt(randomIndex);
  }).join('');
};

try {
  // eslint-disable-next-line no-undef
  const resolvedCrypto = typeof crypto === 'undefined' ? undefined : crypto;
  (generateRandomString as unknown as Writable<GenerateRandomString>).crypto = resolvedCrypto;
} catch {
  // ignore
}

Object.freeze(generateRandomString);

const UNIQUE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
