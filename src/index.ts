import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import express from "express";
import { userRouter } from "./users/user.routes";
import { transactionRouter } from "./transactions/transaction.routes";
import { webhookRouter } from "./webhooks/webhook.routes";
import { errorHandler } from "./middleware/error.middleware";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const app = express();

app.use(express.json());

app.use("/api/v1/users", userRouter);
app.use("/api/v1/transactions", transactionRouter);
app.use("/webhook", webhookRouter);

app.get("/api/v1/health", (req, res) => {
  res.status(200).send({ status: "UP" });
});

app.use(errorHandler);

export const api = functions.https.onRequest(app);

export const makeUppercase = onDocumentCreated(
  "/messages/{documentId}",
  (event) => {
    const original = event.data?.data().original;
    const docId = event.params.documentId;

    console.log("Uppercasing", docId, original);
    const uppercase = original?.toUpperCase();
    return event.data?.ref.set({ uppercase }, { merge: true });
  },
);
