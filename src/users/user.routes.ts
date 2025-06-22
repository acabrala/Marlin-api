/* eslint-disable new-cap */
import { Router } from "express";
import {
  createUserHandler,
  getUserByIdHandler,
  updateUserHandler,
  getUserTransactionsHandler,
  getAllUsersHandler,
} from "./user.handler";
import { makeAuthMiddleware } from "../middleware/auth.middleware";
import { userRepository } from "./user.repository";

const router = Router();

router.post("/", createUserHandler);

const authMiddleware = makeAuthMiddleware(userRepository);
router.use(authMiddleware);

router.get("/", getAllUsersHandler);
router.get("/:id", getUserByIdHandler);
router.put("/:id", updateUserHandler);
router.get("/:id/transactions", getUserTransactionsHandler);

export { router as userRouter };
