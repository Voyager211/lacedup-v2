/**
 * A 24-hex-character ObjectId, and nothing else.
 *
 * Not `mongoose.isValidObjectId`, which also accepts any 12-character string.
 * An id this rejects would otherwise reach `findById`, throw a CastError, and
 * come back as a 500 for what is really a record that does not exist.
 */
export const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
