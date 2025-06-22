/* eslint-disable camelcase */
import { Response, NextFunction } from "express";
import * as TransactionService from "./transaction.service";
import { userRepository } from "../users/user.repository";
import { transactionRepository } from "./transaction.repository";
import { AuthenticatedRequest } from "../types/request";
import { checkRateLimit } from "../utils/rateLimit";

function extractIdempotencyKey(headers: Record<string, unknown>): string | null {
  const key = headers["idempotency-key"];
  if (typeof key === "string" && key.trim() !== "") {
    return key;
  }
  return null;
}

function validateUserId(userId: string | undefined): void {
  if (!userId) {
    const error = new Error("User ID not found in token.");
    (error as any).status = 401;
    throw error;
  }
}

export const createTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    validateUserId(userId);

    await checkRateLimit(userId!, transactionRepository);

    const { payer_id, receiver_id, amount } = req.body;
    const idempotencyKey = extractIdempotencyKey(req.headers);
    if (!idempotencyKey) {
      return res
        .status(400)
        .json({ message: "Idempotency-Key header is required." });
    }

    const result = await TransactionService.createTransactionService(
      {
        payer_id,
        receiver_id,
        amount,
        idempotency_key: idempotencyKey,
      },
      { userRepository, transactionRepository },
    );

    return res.status(201).json({
      transaction_id: result.transaction_id,
      status: result.status,
      created_at: result.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};

export const getTransactionByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    validateUserId(userId);

    await checkRateLimit(userId!, transactionRepository);

    const { id } = req.params;
    if (!id || typeof id !== "string" || id.trim() === "") {
      return res.status(400).json({ message: "Transaction ID must be provided." });
    }

    const transaction = await TransactionService.getTransactionByIdService(id, {
      transactionRepository,
    });

    return res.status(200).json(transaction);
  } catch (error) {
    return next(error);
  }
};
