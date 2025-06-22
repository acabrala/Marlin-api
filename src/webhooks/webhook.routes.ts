import { Router } from "express";
import { makeGetWebhookLogHandler, makePaymentGatewayWebhookHandler } from "./webhook.handler";
import { userRepository } from "../users/user.repository";
import { transactionRepository } from "../transactions/transaction.repository";
import { makeAuthMiddleware } from "../middleware/auth.middleware";
import { webhookRepository } from "./webhook.repository";

// eslint-disable-next-line new-cap
const router = Router();

const authMiddleware = makeAuthMiddleware(userRepository);

router.use(authMiddleware);

router.post(
  "/payment-gateway",
  makePaymentGatewayWebhookHandler({ userRepository, transactionRepository }),
);

router.get(
  "/payment-gateway/logs/:id",
  makeGetWebhookLogHandler({ webhookRepository }),
);

export { router as webhookRouter };
