import { User } from "../models";
import type { UserRepository } from "./user.repository";
import { v4 as uuidv4 } from "uuid";
import {
  DuplicateEmailError,
  ValidationError,
  UserNotFoundError,
} from "../errors";
import { admin } from "../lib/admin";
import { toJSDate } from "../utils";

interface ServiceDependencies {
  userRepository: UserRepository;
}

interface CreateUserDTO {
  name: string;
  email: string;
  balance: number;
}

export const createUserService = async (
  userData: CreateUserDTO,
  { userRepository }: ServiceDependencies,
): Promise<User> => {
  const { name, email, balance } = userData;

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("Name is required and must be a non-empty string.");
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new ValidationError("A valid email is required.");
  }
  if (balance === undefined || typeof balance !== "number" || balance < 0) {
    throw new ValidationError("Balance is required and must be a non-negative number.");
  }

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new DuplicateEmailError(`User with email ${email} already exists.`);
  }

  const userId = uuidv4();
  const now = admin.firestore.Timestamp.now();

  const newUser: User = {
    user_id: userId,
    name,
    email,
    balance,
    createdAt: now,
    updatedAt: now,
  };

  await userRepository.create(newUser);

  return {
    ...newUser,
    createdAt: toJSDate(newUser.createdAt),
    updatedAt: toJSDate(newUser.updatedAt),
  };
};

export const getUserByIdService = async (
  id: string,
  { userRepository }: ServiceDependencies,
): Promise<User> => {
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new ValidationError("User ID must be a non-empty string.");
  }

  const user = await userRepository.findById(id);
  if (!user) {
    throw new UserNotFoundError(`User with ID ${id} not found.`);
  }

  return user;
};

interface UpdateUserDTO {
  name?: string;
  email?: string;
}

export const updateUserService = async (
  id: string,
  updates: UpdateUserDTO,
  { userRepository }: ServiceDependencies,
): Promise<User> => {
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new ValidationError("User ID must be a non-empty string.");
  }

  const { name, email } = updates;

  if (name === undefined && email === undefined) {
    throw new ValidationError("At least one field (name or email) must be provided.");
  }

  if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    throw new ValidationError("Name, if provided, must be a non-empty string.");
  }

  if (email !== undefined && (typeof email !== "string" || !email.includes("@"))) {
    throw new ValidationError("Email, if provided, must be a valid email address.");
  }

  const existingUser = await userRepository.findById(id);
  if (!existingUser) {
    throw new UserNotFoundError(`User with ID ${id} not found.`);
  }

  if (email && email !== existingUser.email) {
    const userWithNewEmail = await userRepository.findByEmail(email);
    if (userWithNewEmail && userWithNewEmail.user_id !== id) {
      throw new DuplicateEmailError(`Email ${email} is already in use by another user.`);
    }
  }

  await userRepository.update(id, updates);

  const updatedUser = await userRepository.findById(id);
  if (!updatedUser) {
    throw new UserNotFoundError(`User with ID ${id} not found after update.`);
  }

  return updatedUser;
};

export const getAllUsersService = async (
  { userRepository }: ServiceDependencies,
): Promise<User[]> => {
  return userRepository.listAll();
};
