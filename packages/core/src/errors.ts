/** Domain error codes understood by the web layer (map to HTTP status via `httpStatus`). */
export type DomainErrorCode = "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "FORBIDDEN";

const STATUS: Record<DomainErrorCode, number> = { NOT_FOUND: 404, CONFLICT: 409, VALIDATION: 400, FORBIDDEN: 403 };

/** Error thrown by core services for expected, user-facing failures. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;
  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = STATUS[code];
    this.details = details;
  }
}

/** Type guard for DomainError. */
export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
