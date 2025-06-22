/* eslint-disable camelcase */
import { Response, NextFunction, Request } from "express";
import { logWebhookEvent, updateWebhookEventStatus, webhookRepository } from "./webhook.repository";
import { processWebhookNotificationService } from "../transactions/transaction.service";
import { UserRepository } from "../users/user.repository";
import { transactionRepository } from "../transactions/transaction.repository";
import { checkRateLimit } from "../utils/rateLimit";
import { AuthenticatedRequest } from "../types/request";

export const makePaymentGatewayWebhookHandler = (dependencies: {
  userRepository: UserRepository;
  transactionRepository: typeof transactionRepository;
}) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const webhookPayload = req.body;
    let eventLogId: string | null = null;

    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found in token." });
      }

      await checkRateLimit(userId, transactionRepository);

      eventLogId = await logWebhookEvent(webhookPayload);

      const { transaction_id, status } = webhookPayload;

      if (!transaction_id || !status) {
        if (eventLogId) {
          await updateWebhookEventStatus(eventLogId, "ignored");
        }
        return res.status(400).json({
          message: "Missing transaction_id or status in webhook payload.",
        });
      }

      if (status !== "approved" && status !== "failed") {
        if (eventLogId) {
          await updateWebhookEventStatus(eventLogId, "ignored");
        }
        return res.status(400).json({
          message: "Invalid status value. Must be 'approved' or 'failed'.",
        });
      }

      await processWebhookNotificationService(
        transaction_id,
        status,
        eventLogId,
        dependencies,
      );

      if (eventLogId) {
        await updateWebhookEventStatus(eventLogId, "processed");
      }

      return res.status(200).json({
        message: "Webhook recebido com sucesso",
        eventLogId,
      });
    } catch (error) {
      if (eventLogId) {
        await updateWebhookEventStatus(eventLogId, "failed");
      }
      return next(error);
    }
  };
};

export const makeGetWebhookLogHandler = (dependencies: {
  webhookRepository: typeof webhookRepository;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logId = req.params.id;
      if (!logId) {
        return res.status(400).json({ message: "Missing log ID" });
      }

      const log = await dependencies.webhookRepository.findById(logId);

      if (!log) {
        return res.status(404).json({ message: "Log not found" });
      }

      return res.status(200).json(log);
    } catch (error) {
      return next(error);
    }
  };
};

