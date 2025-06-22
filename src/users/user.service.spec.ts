/* eslint-disable max-len */
import { v4 as uuidv4 } from "uuid";
import { userRepository } from "./user.repository";
import * as UserService from "./user.service";
import {
  DuplicateEmailError,
  ValidationError,
  UserNotFoundError,
} from "../errors";

jest.mock("uuid");

jest.mock("./user.repository", () => ({
  userRepository: {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    listAll: jest.fn(),
  },
}));

describe("User Service", () => {
  const mockUserRepo = userRepository as jest.Mocked<typeof userRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    (uuidv4 as jest.Mock).mockReset();
  });

  describe("createUserService", () => {
    it("should create a user successfully", async () => {
      const fixedUuid = "fixed-uuid";
      (uuidv4 as jest.Mock).mockReturnValue(fixedUuid);

      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(undefined);

      const baseData = {
        name: "John Doe",
        email: "john@example.com",
        balance: 100,
      };

      const result = await UserService.createUserService(baseData, {
        userRepository: mockUserRepo,
      });

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(baseData.email);
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: fixedUuid,
          name: baseData.name,
          email: baseData.email,
          balance: baseData.balance,
        }),
      );
      expect(result.user_id).toBe(fixedUuid);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it("should throw ValidationError if name is invalid", async () => {
      await expect(
        UserService.createUserService(
          { name: "", email: "a@b.com", balance: 0 },
          { userRepository: mockUserRepo },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw DuplicateEmailError if email already exists", async () => {
      const existingUser = {
        user_id: "existing",
        name: "Exist",
        email: "dup@example.com",
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserRepo.findByEmail.mockResolvedValue(existingUser);

      await expect(
        UserService.createUserService(
          { name: "New User", email: "dup@example.com", balance: 10 },
          { userRepository: mockUserRepo },
        ),
      ).rejects.toThrow(DuplicateEmailError);
    });
  });

  describe("getUserByIdService", () => {
    it("should return user if found", async () => {
      const user = {
        user_id: "user-123",
        name: "Test User",
        email: "test@example.com",
        balance: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserRepo.findById.mockResolvedValue(user);

      const result = await UserService.getUserByIdService(user.user_id, {
        userRepository: mockUserRepo,
      });

      expect(mockUserRepo.findById).toHaveBeenCalledWith(user.user_id);
      expect(result).toEqual(user);
    });

    it("should throw ValidationError if id is invalid", async () => {
      await expect(
        UserService.getUserByIdService("", { userRepository: mockUserRepo }),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw UserNotFoundError if user does not exist", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        UserService.getUserByIdService("nonexistent-id", {
          userRepository: mockUserRepo,
        }),
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  describe("updateUserService", () => {
    const existingUser = {
      user_id: "user-123",
      name: "Old Name",
      email: "old@example.com",
      balance: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should update user successfully", async () => {
      mockUserRepo.findById.mockResolvedValue(existingUser);
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.update.mockResolvedValue(undefined);

      mockUserRepo.findById.mockResolvedValueOnce(existingUser).mockResolvedValueOnce({
        ...existingUser,
        name: "New Name",
      });

      const updates = { name: "New Name" };

      const result = await UserService.updateUserService(existingUser.user_id, updates, {
        userRepository: mockUserRepo,
      });

      expect(mockUserRepo.findById).toHaveBeenCalledWith(existingUser.user_id);
      expect(mockUserRepo.update).toHaveBeenCalledWith(existingUser.user_id, updates);
      expect(result.name).toBe("New Name");
    });

    it("should throw ValidationError if id is invalid", async () => {
      await expect(
        UserService.updateUserService("", { name: "New" }, { userRepository: mockUserRepo }),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError if no fields provided", async () => {
      await expect(
        UserService.updateUserService("some-id", {}, { userRepository: mockUserRepo }),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw UserNotFoundError if user not found", async () => {
      mockUserRepo.findById.mockResolvedValue(null);
      await expect(
        UserService.updateUserService("not-found-id", { name: "New" }, { userRepository: mockUserRepo }),
      ).rejects.toThrow(UserNotFoundError);
    });

    it("should throw DuplicateEmailError if email already in use by another user", async () => {
      mockUserRepo.findById.mockResolvedValue(existingUser);

      const otherUser = {
        user_id: "other-user",
        name: "Other",
        email: "newemail@example.com",
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepo.findByEmail.mockResolvedValue(otherUser);

      await expect(
        UserService.updateUserService(existingUser.user_id, { email: otherUser.email }, { userRepository: mockUserRepo }),
      ).rejects.toThrow(DuplicateEmailError);
    });
  });

  describe("getAllUsersService", () => {
    it("should return list of users", async () => {
      const users = [
        { user_id: "1", name: "A", email: "a@example.com", balance: 10, createdAt: new Date(), updatedAt: new Date() },
        { user_id: "2", name: "B", email: "b@example.com", balance: 20, createdAt: new Date(), updatedAt: new Date() },
      ];
      mockUserRepo.listAll.mockResolvedValue(users);

      const result = await UserService.getAllUsersService({ userRepository: mockUserRepo });

      expect(mockUserRepo.listAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });
});
