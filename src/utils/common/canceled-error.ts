/**
 * Error used to indicate that an operation was cancelled intentionally.
 */
export class CanceledError extends Error {
  public constructor(message = 'the operation was cancelled') {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'CanceledError';
  }
}
