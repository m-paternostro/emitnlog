/**
 * Generates a random string of the specified length using "safe" alphanumeric characters (i.e., "A-Z", "a-z" and
 * "0-9"). Uses multiple entropy sources to improve randomness, but is NOT cryptographically secure.
 *
 * @example
 *
 * ```ts
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
 * For security-sensitive applications, use a cryptographically secure random generator instead.
 */
export const generateRandomString = (length = 8) => {
  if (length < 8 || length > 128) {
    throw new Error('IllegalArgument: length must be a number between 8 and 128');
  }

  const timestamp = Date.now();
  return Array.from({ length }, () => {
    const entropy = timestamp + performance.now();
    const randomIndex = Math.floor(((Math.random() * entropy) % 1) * UNIQUE_CHARACTERS.length);
    return UNIQUE_CHARACTERS.charAt(randomIndex);
  }).join('');
};

const UNIQUE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
