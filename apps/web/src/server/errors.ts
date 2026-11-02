/** Typed API error. Route handlers throw these; `route()` renders the documented shape. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message = "Invalid request", details?: unknown) => new ApiError(400, "bad_request", message, details);
export const unauthorized = (message = "Authentication required") => new ApiError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this resource") => new ApiError(403, "forbidden", message);
export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
export const conflict = (message: string, details?: unknown) => new ApiError(409, "conflict", message, details);
export const tooManyRequests = (retryAfterSec = 60) => new ApiError(429, "rate_limited", "Too many requests", { retryAfterSec });
