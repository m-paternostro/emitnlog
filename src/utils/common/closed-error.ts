/**
 * Error used to indicate that an operation was performed after its scope was closed.
 */
export class ClosedError extends Error {
  public constructor(message = 'the operation was performed after its scope was closed') {
    super(message);
    this.name = new.target.name;

    // Not needed for target >= ES2023
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
