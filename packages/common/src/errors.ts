export class BeaconError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BeaconError";
  }
}

export class NotFoundError extends BeaconError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404, { resource, id });
    this.name = "NotFoundError";
  }
}

export class AuthenticationError extends BeaconError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends BeaconError {
  constructor(message = "Insufficient permissions") {
    super(message, "FORBIDDEN", 403);
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends BeaconError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class ConflictError extends BeaconError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends BeaconError {
  constructor(message = "Rate limit exceeded") {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}

export class ResourceExhaustedError extends BeaconError {
  constructor(resource: string) {
    super(`Resource exhausted: ${resource}`, "RESOURCE_EXHAUSTED", 429, { resource });
    this.name = "ResourceExhaustedError";
  }
}
