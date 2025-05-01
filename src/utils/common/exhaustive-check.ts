/**
 * Exhaustive check to ensure all cases are handled.
 *
 * Typically used in switch statements to ensure all cases are handled at compile time.
 *
 * @example
 *
 * ```ts
 * type Fruit = 'apple' | 'banana' | 'orange';
 * const fruit: Fruit = 'apple';
 * switch (fruit) {
 *   case 'apple':
 *     return '🍎';
 *   case 'banana':
 *     return '🍌';
 *   case 'orange':
 *     return '🍊';
 *   default:
 *     exhaustiveCheck(fruit);
 * }
 * ```
 *
 * @param _ - The never-used parameter.
 */
export const exhaustiveCheck = (_: never) => void 0;
