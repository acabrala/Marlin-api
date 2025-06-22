/* eslint-disable new-cap */
import { Router } from "express";
import {
  createTransactionHandler,
  getTransactionByIdHandler,
} from "./transaction.handler";
import { makeAuthMiddleware } from "../middleware/auth.middleware";
import { userRepository } from "../users/user.repository";

const router = Router();

const authMiddleware = makeAuthMiddleware(userRepository);
router.use(authMiddleware);

router.post("/", createTransactionHandler);
router.get("/:id", getTransactionByIdHandler);

export { router as transactionRouter };
