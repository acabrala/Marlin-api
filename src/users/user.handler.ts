/* eslint-disable camelcase */
import { Request, Response, NextFunction } from "express";
import * as UserService from "./user.service";
import * as TransactionService from "../transactions/transaction.service";
import { userRepository } from "./user.repository";
import { transactionRepository } from "../transactions/transaction.repository";
import { checkRateLimit } from "../utils/rateLimit";
import { AuthenticatedRequest } from "../types/request";

export const createUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, email, balance } = req.body;

    const newUser = await UserService.createUserService(
      { name, email, balance },
      { userRepository },
    );

    return res.status(201).json(newUser);
  } catch (error) {
    return next(error);
  }
};

export const getUserTransactionsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    console.log(req.params, 34343);
    if (!userId) {
      return res.status(401).json({ message: "User ID not found in token." });
    }

    await checkRateLimit(userId, transactionRepository);

    const transactions = await TransactionService.getTransactionsForUserService(
      id,
      { userRepository, transactionRepository },
    );

    return res.status(200).json(transactions);
  } catch (error) {
    return next(error);
  }
};

export const updateUserHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, email } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "User ID not found in token." });
    }

    await checkRateLimit(userId, transactionRepository);

    const updatedUser = await UserService.updateUserService(
      id,
      { name, email },
      { userRepository },
    );

    return res.status(200).json(updatedUser);
  } catch (error) {
    return next(error);
  }
};

export const getUserByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "User ID not found in token." });
    }

    await checkRateLimit(userId, transactionRepository);

    const user = await UserService.getUserByIdService(id, { userRepository });

    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

export const getAllUsersHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "User ID not found in token." });
    }

    await checkRateLimit(userId, transactionRepository);

    const users = await UserService.getAllUsersService({ userRepository });

    return res.status(200).json(users);
  } catch (error) {
    return next(error);
  }
};
