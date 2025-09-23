/**
 * Error used to indicate that an operation was cancelled intentionally.
 */
export class CanceledError extends Error {
  public constructor(message = 'the operation was cancelled') {
    super(message);
    this.name = new.target.name;

    // Not needed for target >= ES2023
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
