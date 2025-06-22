/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";

interface ErrorResponse {
  message: string;
  details?: any;
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  console.error(`Error occurred: ${err.name} - ${err.message}`, err.stack);

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError ? err.message : "Internal Server Error";

  const errorResponse: ErrorResponse = { message };

  if (statusCode === 500 || process.env.NODE_ENV === "development") {
    console.error(`Error occurred: ${err.name} - ${err.message}`, err.stack);
    if (statusCode === 500 && process.env.NODE_ENV === "production") {
      errorResponse.message =
        "An unexpected error occurred. Please try again later.";
    }
  }

  res.status(statusCode).json(errorResponse);
};
