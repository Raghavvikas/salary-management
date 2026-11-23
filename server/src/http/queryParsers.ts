import { z } from 'zod';

/**
 * Query strings carry lists as `ids=1,4,9`. These two parsers turn that into real
 * arrays once, so every endpoint reads filters the same way.
 */

export const idListParam = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((id) => Number.isInteger(id) && id > 0)
      : undefined,
  );

export const enumListParam = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((part) => part.trim()) : undefined))
    .pipe(z.array(z.enum(values)).optional());
