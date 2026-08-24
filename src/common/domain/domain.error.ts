export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 422,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
