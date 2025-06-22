/* eslint-disable max-len */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors";
import { UserRepository } from "../users/user.repository";

const JWT_SECRET = process.env.JWT_SECRET || "supersegura_supersegura_supersegura_123";

interface TokenPayload {
  userId: string;
  // outros campos, ex: roles, email...
}

// Se quiser, defina um tipo para Request autenticada
export interface AuthenticatedRequest extends Request {
  userId: string;
}

export const makeAuthMiddleware = (userRepository: UserRepository) =>
  async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError("AuthError", "Unauthorized: Missing or malformed Bearer token.", 401);
      }

      const token = authHeader.split(" ")[1];
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;

      if (!payload.userId) {
        throw new AppError("AuthError", "Unauthorized: Token missing userId.", 401);
      }

      // Aqui você pode validar se o usuário existe
      const userExists = await userRepository.findById(payload.userId);
      if (!userExists) {
        throw new AppError("AuthError", "Unauthorized: User not found.", 401);
      }

      req.userId = payload.userId;
      next();
    } catch (error) {
      next(error);
    }
  };
