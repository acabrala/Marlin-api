/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable max-len */
/* eslint-disable camelcase */
import { v4 as uuidv4 } from "uuid";
import { admin } from "../lib/admin";
import { Transaction } from "../models";
import { UserRepository } from "../users/user.repository";
import { TransactionRepository } from "./transaction.repository";

import {
  ValidationError,
  UserNotFoundError,
  IdempotencyKeyUsedError,
  InsufficientBalanceError,
  TransactionNotFoundError,
} from "../errors";
import { checkRateLimit } from "../utils/rateLimit";
import { toJSDate } from "../utils";

interface CreateTransactionDTO {
  payer_id: string;
  receiver_id: string;
  amount: number;
  idempotency_key: string;
}

interface TransactionResult {
  transaction_id: string;
  status: "pending" | "approved" | "failed";
  createdAt: Date | null;
}

interface ServiceDependencies {
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
}

export const createTransactionService = async (
  dto: CreateTransactionDTO,
  { userRepository, transactionRepository }: ServiceDependencies,
): Promise<TransactionResult> => {
  const { payer_id, receiver_id, amount, idempotency_key } = dto;

  if (!payer_id || !receiver_id || !amount || !idempotency_key) {
    throw new ValidationError(
      "Missing required fields: payer_id, receiver_id, amount, idempotency_key.",
    );
  }

  if (typeof amount !== "number" || amount <= 0) {
    throw new ValidationError("Amount must be a positive number.");
  }

  if (payer_id === receiver_id) {
    throw new ValidationError("Payer and receiver cannot be the same user.");
  }

  await checkRateLimit(payer_id, transactionRepository);

  const existingTransaction = await transactionRepository.findTransactionByIdempotencyKey(idempotency_key);
  if (existingTransaction) {
    throw new IdempotencyKeyUsedError(
      "Transaction with this idempotency key already processed.",
    );
  }

  const payer = await userRepository.findById(payer_id);
  if (!payer) {
    throw new UserNotFoundError(`Payer with ID ${payer_id} not found.`);
  }
  if (payer.balance < amount) {
    throw new InsufficientBalanceError("Payer has insufficient balance.");
  }

  const receiver = await userRepository.findById(receiver_id);
  if (!receiver) {
    throw new UserNotFoundError(`Receiver with ID ${receiver_id} not found.`);
  }

  const transaction_id = uuidv4();
  const now = admin.firestore.Timestamp.now().toDate();

  const newTransaction: Transaction = {
    transaction_id,
    payer_id,
    receiver_id,
    amount,
    status: "pending",
    idempotency_key,
    createdAt: now,
    updatedAt: now,
  };

  const newPayerBalance = payer.balance - amount;

  await transactionRepository.createTransactionWithBalanceUpdate(newTransaction, payer_id, newPayerBalance);

  return {
    transaction_id,
    status: newTransaction.status,
    createdAt: toJSDate(newTransaction.createdAt),
  };
};

interface TransactionDetailResponse {
  transaction_id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  status: "pending" | "approved" | "failed";
  created_at: Date;
}

export const getTransactionByIdService = async (
  id: string,
  { transactionRepository }: Pick<ServiceDependencies, "transactionRepository">,
): Promise<TransactionDetailResponse> => {
  if (!id?.trim()) {
    throw new ValidationError("Transaction ID must be a non-empty string.");
  }

  const transaction = await transactionRepository.findTransactionById(id);
  if (!transaction) {
    throw new TransactionNotFoundError(`Transaction with ID ${id} not found.`);
  }

  return {
    transaction_id: transaction.transaction_id,
    payer_id: transaction.payer_id,
    receiver_id: transaction.receiver_id,
    amount: transaction.amount,
    status: transaction.status,
    created_at: toJSDate(transaction.createdAt)!,
  };
};

interface UserTransactionResponse {
  transaction_id: string;
  direction: "sent" | "received";
  amount: number;
  status: "pending" | "approved" | "failed";
}

export const getTransactionsForUserService = async (
  userId: string,
  { userRepository, transactionRepository }: ServiceDependencies,
): Promise<UserTransactionResponse[]> => {
  if (!userId?.trim()) {
    throw new ValidationError("User ID must be a non-empty string.");
  }

  await checkRateLimit(userId, transactionRepository);

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new UserNotFoundError(`User with ID ${userId} not found.`);
  }

  const transactions = await transactionRepository.findTransactionsByUserId(userId);

  return transactions.map((tx) => ({
    transaction_id: tx.transaction_id,
    direction: tx.payer_id === userId ? "sent" : "received",
    amount: tx.amount,
    status: tx.status,
  }));
};

export const processWebhookNotificationService = async (
  transaction_id: string,
  newStatus: "approved" | "failed",
  webhookLogId: string | null,
  dependencies: ServiceDependencies & { firestoreBatch?: FirebaseFirestore.WriteBatch },
): Promise<void> => {
  const { userRepository, transactionRepository, firestoreBatch } = dependencies;

  if (!transaction_id?.trim() || !newStatus) {
    throw new ValidationError("Missing transaction_id or newStatus for webhook processing.");
  }
  if (!["approved", "failed"].includes(newStatus)) {
    throw new ValidationError("Invalid newStatus. Must be 'approved' or 'failed'.");
  }

  const transaction = await transactionRepository.findTransactionById(transaction_id);
  if (!transaction) {
    throw new TransactionNotFoundError(`Transaction with ID ${transaction_id} not found.`);
  }

  if (transaction.status !== "pending") {
    console.info(
      `Webhook for transaction ${transaction_id} (log: ${webhookLogId}) ignored: ` +
      `Transaction status is already '${transaction.status}'.`,
    );
    return;
  }

  const batch = firestoreBatch || admin.firestore().batch();

  await transactionRepository.updateTransactionStatus(transaction_id, newStatus, batch);

  if (newStatus === "approved") {
    const receiver = await userRepository.findById(transaction.receiver_id);
    if (!receiver) {
      throw new UserNotFoundError(
        `Receiver user ${transaction.receiver_id} not found for approved transaction ${transaction_id}.`,
      );
    }
    const newReceiverBalance = receiver.balance + transaction.amount;
    userRepository.updateBalance(batch, transaction.receiver_id, newReceiverBalance);
  } else if (newStatus === "failed") {
    const payer = await userRepository.findById(transaction.payer_id);
    if (!payer) {
      throw new UserNotFoundError(
        `Payer user ${transaction.payer_id} not found for failed transaction ${transaction_id} refund.`,
      );
    }
    const newPayerBalance = payer.balance + transaction.amount;
    userRepository.updateBalance(batch, transaction.payer_id, newPayerBalance);
  }

  try {
    await batch.commit();
  } catch (error) {
    console.error(`Batch commit failed for webhook (log: ${webhookLogId}, tx: ${transaction_id}):`, error);
    throw error;
  }
};
