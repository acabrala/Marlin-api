export class AppError extends Error {
  public readonly statusCode: number;

  constructor(name: string, message: string, statusCode: number) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed.") {
    super("ValidationError", message, 400);
  }
}

export class UserNotFoundError extends AppError {
  constructor(message = "User not found.") {
    super("UserNotFoundError", message, 404);
  }
}

export class DuplicateEmailError extends AppError {
  constructor(message = "Email already exists.") {
    super("DuplicateEmailError", message, 409);
  }
}

export class IdempotencyKeyUsedError extends AppError {
  constructor(message = "Idempotency key already used.") {
    super("IdempotencyKeyUsedError", message, 409);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message = "Insufficient balance.") {
    super("InsufficientBalanceError", message, 400);
  }
}

export class TransactionNotFoundError extends AppError {
  constructor(message = "Transaction not found.") {
    super("TransactionNotFoundError", message, 404);
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message = "Rate limit exceeded. Please try again later.") {
    super("RateLimitExceededError", message, 429);
  }
}
