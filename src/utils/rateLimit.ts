import { admin } from "../lib/admin";
import { TransactionRepository } from "../transactions/transaction.repository";
import { RateLimitExceededError } from "../errors";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

export const checkRateLimit = async (
  userId: string,
  transactionRepository: TransactionRepository,
): Promise<void> => {
  await admin.firestore().runTransaction(async (firestoreTx) => {
    const now = Date.now();
    const timestamps = (await transactionRepository.getRateLimitTimestamps(
      userId,
      firestoreTx,
    )) ?? [];

    const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

    if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
      throw new RateLimitExceededError(
        "Too many requests. Please try again later.",
      );
    }

    recent.push(now);
    await transactionRepository.setRateLimitTimestamps(
      userId,
      recent,
      firestoreTx,
    );
  });
};
