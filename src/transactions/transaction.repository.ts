/* eslint-disable camelcase */
import { admin } from "../lib/admin";
import { Transaction } from "../models";

const db = admin.firestore();

const transactionsCollection = db.collection("transactions");
const rateLimitsCollection = db.collection("transaction_rate_limits");

export interface RateLimitDoc {
  payer_id: string;
  timestamps: number[];
}

const fromDocToTransaction = (doc: FirebaseFirestore.DocumentSnapshot): Transaction => {
  const data = doc.data();
  if (!data) throw new Error("Document data is undefined");

  return {
    transaction_id: doc.id,
    payer_id: data.payer_id,
    receiver_id: data.receiver_id,
    amount: data.amount,
    status: data.status,
    idempotency_key: data.idempotency_key,
    createdAt: (data.createdAt as admin.firestore.Timestamp).toDate(),
    updatedAt: (data.updatedAt as admin.firestore.Timestamp).toDate(),
  };
};

const findTransactionByIdempotencyKey = async (
  key: string,
): Promise<Transaction | null> => {
  try {
    const snapshot = await transactionsCollection
      .where("idempotency_key", "==", key)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    return fromDocToTransaction(snapshot.docs[0]);
  } catch (error) {
    console.error(`Failed to find transaction by idempotency key ${key}:`, error);
    throw error;
  }
};

const createTransactionWithBalanceUpdate = async (
  transactionData: Transaction,
  payerId: string,
  newPayerBalance: number,
): Promise<void> => {
  try {
    const payerRef = db.collection("users").doc(payerId);
    const transactionRef = transactionsCollection.doc(transactionData.transaction_id);

    const batch = db.batch();
    batch.set(transactionRef, transactionData);
    batch.update(payerRef, {
      balance: newPayerBalance,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await batch.commit();
  } catch (error) {
    console.error(`Failed to create transaction and update balance for payer ${payerId}:`, error);
    throw error;
  }
};

const findTransactionById = async (id: string): Promise<Transaction | null> => {
  try {
    const doc = await transactionsCollection.doc(id).get();
    return doc.exists ? fromDocToTransaction(doc) : null;
  } catch (error) {
    console.error(`Failed to find transaction by id ${id}:`, error);
    throw error;
  }
};

const findTransactionsByUserId = async (userId: string): Promise<Transaction[]> => {
  try {
    const [sentSnapshot, receivedSnapshot] = await Promise.all([
      transactionsCollection.where("payer_id", "==", userId).orderBy("createdAt", "desc").get(),
      transactionsCollection.where("receiver_id", "==", userId).orderBy("createdAt", "desc").get(),
    ]);

    const sentTransactions = sentSnapshot.docs.map(fromDocToTransaction);
    const receivedTransactions = receivedSnapshot.docs.map(fromDocToTransaction);

    const transactions = [...sentTransactions, ...receivedTransactions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    return transactions;
  } catch (error) {
    console.error(`Failed to find transactions for user ${userId}:`, error);
    throw error;
  }
};

const updateTransactionStatus = async (
  transaction_id: string,
  status: "approved" | "failed",
  batch?: admin.firestore.WriteBatch,
): Promise<void> => {
  try {
    const transactionRef = transactionsCollection.doc(transaction_id);
    const updateData = {
      status,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (batch) {
      batch.update(transactionRef, updateData);
    } else {
      await transactionRef.update(updateData);
    }
  } catch (error) {
    console.error(`Failed to update transaction status for ${transaction_id}:`, error);
    throw error;
  }
};

const getRateLimitTimestamps = async (
  payerId: string,
  firestoreTransaction?: admin.firestore.Transaction,
): Promise<number[]> => {
  try {
    const docRef = rateLimitsCollection.doc(payerId);
    const doc = firestoreTransaction
      // eslint-disable-next-line operator-linebreak
      ? await firestoreTransaction.get(docRef)
      // eslint-disable-next-line operator-linebreak
      : await docRef.get();

    return doc.exists ? (doc.data() as RateLimitDoc).timestamps ?? [] : [];
  } catch (error) {
    console.error(`Failed to get rate limit timestamps for payer ${payerId}:`, error);
    throw error;
  }
};

const setRateLimitTimestamps = async (
  payerId: string,
  timestamps: number[],
  firestoreTransaction?: admin.firestore.Transaction,
): Promise<void> => {
  try {
    const docRef = rateLimitsCollection.doc(payerId);
    const data: RateLimitDoc = { payer_id: payerId, timestamps };

    if (firestoreTransaction) {
      firestoreTransaction.set(docRef, data);
    } else {
      await docRef.set(data);
    }
  } catch (error) {
    console.error(`Failed to set rate limit timestamps for payer ${payerId}:`, error);
    throw error;
  }
};

export const transactionRepository = {
  findTransactionByIdempotencyKey,
  createTransactionWithBalanceUpdate,
  findTransactionById,
  findTransactionsByUserId,
  updateTransactionStatus,
  getRateLimitTimestamps,
  setRateLimitTimestamps,
};

export type TransactionRepository = typeof transactionRepository;
