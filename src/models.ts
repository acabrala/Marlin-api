import * as admin from "firebase-admin";

type Timestamp = admin.firestore.Timestamp;

export interface User {
  user_id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: Timestamp | Date | null;
  updatedAt: Timestamp | Date | null;
}

export interface Transaction {
  transaction_id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  status: "pending" | "approved" | "failed";
  idempotency_key: string;
  createdAt: Date;
  updatedAt: Date;
}
