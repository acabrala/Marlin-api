/* eslint-disable max-len */
import * as TransactionService from "./transaction.service";
import { transactionRepository } from "./transaction.repository";
import { userRepository } from "../users/user.repository";
import { User, Transaction } from "../models";
import {
  IdempotencyKeyUsedError,
  UserNotFoundError,
  InsufficientBalanceError,
  TransactionNotFoundError,
  RateLimitExceededError,
  ValidationError,
} from "../errors";
import { v4 as uuidv4 } from "uuid";
import * as admin from "firebase-admin";

jest.mock("firebase-admin");
jest.mock("./transaction.repository");
jest.mock("../users/user.repository");
jest.mock("uuid");

const fixedDate = new Date("2023-01-01T12:00:00.000Z");
const fixedTimestamp = admin.firestore.Timestamp.fromDate(fixedDate);

describe("Transaction Service", () => {
  let mockTxRepo: jest.Mocked<typeof transactionRepository>;
  let mockUserRepo: jest.Mocked<typeof userRepository>;
  let mockUuid: jest.Mock;

  const validDto = {
    payer_id: "payer123",
    receiver_id: "receiver123",
    amount: 100,
    idempotency_key: "idem-key-123",
  };

  const mockPayer: User = {
    user_id: "payer123",
    balance: 200,
    name: "Payer Name",
    email: "payer@example.com",
    createdAt: new Date("2022-01-01"),
    updatedAt: new Date("2022-06-01"),
  };

  const mockReceiver: User = {
    user_id: "receiver123",
    balance: 50,
    name: "Receiver Name",
    email: "receiver@example.com",
    createdAt: new Date("2022-01-02"),
    updatedAt: new Date("2022-06-02"),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTxRepo = {
      findTransactionsByUserId: jest.fn(),
      findTransactionById: jest.fn(),
      updateTransactionStatus: jest.fn(),
      findTransactionByIdempotencyKey: jest.fn(),
      createTransactionWithBalanceUpdate: jest.fn(),
      getRateLimitTimestamps: jest.fn(),
      setRateLimitTimestamps: jest.fn(),
    };

    mockUserRepo = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      updateBalance: jest.fn(),
      update: jest.fn(),
      listAll: jest.fn(),
    };

    mockUuid = uuidv4 as jest.Mock;

    mockUuid.mockReturnValue("tx-uuid-123");

    jest.spyOn(admin.firestore.Timestamp, "now").mockReturnValue(fixedTimestamp);
  });

  describe("createTransactionService", () => {
    it("creates a transaction successfully", async () => {
      mockTxRepo.findTransactionByIdempotencyKey.mockResolvedValue(null);

      mockUserRepo.findById.mockImplementation(async (id) => {
        if (id === "payer123") return mockPayer;
        if (id === "receiver123") return mockReceiver;
        return null;
      });

      mockTxRepo.getRateLimitTimestamps.mockResolvedValue([Date.now() - 10000]);

      const result = await TransactionService.createTransactionService(validDto, {
        transactionRepository: mockTxRepo,
        userRepository: mockUserRepo,
      });

      expect(result).toEqual({
        transaction_id: "tx-uuid-123",
        status: "pending",
        createdAt: expect.any(Date),
      });
      expect(mockTxRepo.createTransactionWithBalanceUpdate).toHaveBeenCalled();
    });

    it("throws IdempotencyKeyUsedError when idempotency key is reused", async () => {
      mockTxRepo.findTransactionByIdempotencyKey.mockResolvedValue({
        transaction_id: "existing-tx-id",
        payer_id: "payer123",
        receiver_id: "receiver123",
        amount: 100,
        status: "pending",
        idempotency_key: validDto.idempotency_key,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockUserRepo.findById.mockResolvedValue(mockPayer);
      mockTxRepo.getRateLimitTimestamps.mockResolvedValue([]);

      await expect(
        TransactionService.createTransactionService(validDto, {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
        }),
      ).rejects.toThrow(IdempotencyKeyUsedError);
    });

    it("throws UserNotFoundError if payer does not exist", async () => {
      mockTxRepo.findTransactionByIdempotencyKey.mockResolvedValue(null);
      mockTxRepo.getRateLimitTimestamps.mockResolvedValue([]);
      mockUserRepo.findById.mockResolvedValueOnce(null);

      await expect(
        TransactionService.createTransactionService(validDto, {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
        }),
      ).rejects.toThrow(UserNotFoundError);
    });

    it("throws UserNotFoundError if receiver does not exist", async () => {
      mockTxRepo.findTransactionByIdempotencyKey.mockResolvedValue(null);
      mockTxRepo.getRateLimitTimestamps.mockResolvedValue([]);
      mockUserRepo.findById.mockResolvedValueOnce(mockPayer);
      mockUserRepo.findById.mockResolvedValueOnce(null);

      await expect(
        TransactionService.createTransactionService(validDto, {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
        }),
      ).rejects.toThrow(UserNotFoundError);
    });

    it("throws InsufficientBalanceError if payer has insufficient funds", async () => {
      mockTxRepo.findTransactionByIdempotencyKey.mockResolvedValue(null);
      mockTxRepo.getRateLimitTimestamps.mockResolvedValue([]);
      mockUserRepo.findById.mockResolvedValueOnce({ ...mockPayer, balance: 50 });
      mockUserRepo.findById.mockResolvedValueOnce(mockReceiver);

      await expect(
        TransactionService.createTransactionService(validDto, {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
        }),
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it("throws ValidationError if payer and receiver are the same user", async () => {
      await expect(
        TransactionService.createTransactionService(
          { ...validDto, receiver_id: "payer123" },
          { transactionRepository: mockTxRepo, userRepository: mockUserRepo },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("throws RateLimitExceededError if rate limit is exceeded", async () => {
      mockUserRepo.findById.mockImplementation(async (id) => {
        if (id === "payer123") return mockPayer;
        if (id === "receiver123") return mockReceiver;
        return null;
      });

      const now = Date.now();
      const recentTimestamps = Array(5).fill(now - 5000);
      mockTxRepo.getRateLimitTimestamps.mockResolvedValue(recentTimestamps);

      await expect(
        TransactionService.createTransactionService(validDto, {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
        }),
      ).rejects.toThrow(RateLimitExceededError);
    });
  });

  describe("getTransactionByIdService", () => {
    it("returns transaction when found", async () => {
      const tx: Transaction = {
        transaction_id: "tx-123",
        payer_id: "p1",
        receiver_id: "r1",
        amount: 10,
        status: "approved",
        createdAt: fixedDate,
        updatedAt: fixedDate,
        idempotency_key: "idem-key-123",
      };

      mockTxRepo.findTransactionById.mockResolvedValue(tx);

      const result = await TransactionService.getTransactionByIdService("tx-123", {
        transactionRepository: mockTxRepo,
      });

      expect(result).toMatchObject({
        transaction_id: tx.transaction_id,
        payer_id: tx.payer_id,
        receiver_id: tx.receiver_id,
        amount: tx.amount,
        status: tx.status,
        created_at: fixedDate,
      });
    });

    it("throws TransactionNotFoundError when transaction not found", async () => {
      mockTxRepo.findTransactionById.mockResolvedValue(null);

      await expect(
        TransactionService.getTransactionByIdService("tx-123", {
          transactionRepository: mockTxRepo,
        }),
      ).rejects.toThrow(TransactionNotFoundError);
    });
  });

  describe("getTransactionsForUserService", () => {
    const userId = "user123";

    it("returns transactions with correct directions", async () => {
      mockUserRepo.findById.mockResolvedValue({
        user_id: userId,
        name: "Test User",
        email: "test@example.com",
        balance: 100,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });

      const txList: Transaction[] = [
        {
          transaction_id: "tx1",
          payer_id: userId,
          receiver_id: "otherUser",
          amount: 50,
          status: "approved",
          createdAt: fixedDate,
          updatedAt: fixedDate,
          idempotency_key: "key1",
        },
        {
          transaction_id: "tx2",
          payer_id: "otherUser",
          receiver_id: userId,
          amount: 30,
          status: "pending",
          createdAt: fixedDate,
          updatedAt: fixedDate,
          idempotency_key: "key2",
        },
      ];

      mockTxRepo.findTransactionsByUserId.mockResolvedValue(txList);

      const result = await TransactionService.getTransactionsForUserService(userId, {
        transactionRepository: mockTxRepo,
        userRepository: mockUserRepo,
      });

      expect(result).toHaveLength(2);

      expect(result[0]).toMatchObject({
        transaction_id: "tx1",
        direction: "sent",
      });

      expect(result[1]).toMatchObject({
        transaction_id: "tx2",
        direction: "received",
      });
    });

    it("throws UserNotFoundError when user does not exist", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        TransactionService.getTransactionsForUserService(userId, {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
        }),
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  describe("processWebhookNotificationService", () => {
    const existingTransaction: Transaction = {
      transaction_id: "tx-123",
      payer_id: "payer123",
      receiver_id: "receiver123",
      amount: 100,
      status: "pending",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      idempotency_key: "idem-key-123",
    };

    const mockBatch = {
      update: jest.fn(),
      set: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    const mockPayer: User = {
      user_id: "payer123",
      name: "Mock Payer",
      email: "payer@example.com",
      balance: 1000,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    };

    const mockReceiver = {
      user_id: "receiver123",
      name: "Mock Receiver",
      balance: 500,
      email: "receiver@example.com",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    };

    beforeEach(() => {
      mockTxRepo.findTransactionById.mockReset();
      mockTxRepo.updateTransactionStatus.mockReset();
      mockUserRepo.findById.mockReset();
      mockUserRepo.updateBalance.mockReset();
      mockBatch.update.mockReset();
      mockBatch.commit.mockReset();
    });

    it("processa uma transação aprovada e atualiza saldo do receiver", async () => {
      mockTxRepo.findTransactionById.mockResolvedValue(existingTransaction);
      mockUserRepo.findById.mockImplementation(async (id) => {
        if (id === "receiver123") return { ...mockReceiver };
        return null;
      });

      await TransactionService.processWebhookNotificationService(
        "tx-123",
        "approved",
        "log-1",
        {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
          firestoreBatch: mockBatch,
        },
      );

      expect(mockTxRepo.updateTransactionStatus).toHaveBeenCalledWith("tx-123", "approved", mockBatch);
      expect(mockUserRepo.updateBalance).toHaveBeenCalledWith(mockBatch, "receiver123", 600);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("processa uma transação falhada e reembolsa o payer", async () => {
      mockTxRepo.findTransactionById.mockResolvedValue(existingTransaction);
      mockUserRepo.findById.mockImplementation(async (id) => {
        if (id === "payer123") return { ...mockPayer };
        return null;
      });

      await TransactionService.processWebhookNotificationService(
        "tx-123",
        "failed",
        "log-2",
        {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
          firestoreBatch: mockBatch,
        },
      );

      expect(mockTxRepo.updateTransactionStatus).toHaveBeenCalledWith("tx-123", "failed", mockBatch);
      expect(mockUserRepo.updateBalance).toHaveBeenCalledWith(mockBatch, "payer123", 1100);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("ignora a transação se já estiver com status diferente de pending", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-as-const
      const tx = { ...existingTransaction, status: "approved" as "approved" };
      mockTxRepo.findTransactionById.mockResolvedValue(tx);

      await TransactionService.processWebhookNotificationService(
        "tx-123",
        "approved",
        "log-3",
        {
          transactionRepository: mockTxRepo,
          userRepository: mockUserRepo,
          firestoreBatch: mockBatch,
        },
      );

      expect(mockTxRepo.updateTransactionStatus).not.toHaveBeenCalled();
      expect(mockUserRepo.updateBalance).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });

    it("lança TransactionNotFoundError se a transação não existir", async () => {
      mockTxRepo.findTransactionById.mockResolvedValue(null);

      await expect(
        TransactionService.processWebhookNotificationService(
          "tx-999",
          "approved",
          "log-4",
          {
            transactionRepository: mockTxRepo,
            userRepository: mockUserRepo,
            firestoreBatch: mockBatch,
          },
        ),
      ).rejects.toThrow(TransactionNotFoundError);
    });

    it("lança erro se receiver não for encontrado em approved", async () => {
      mockTxRepo.findTransactionById.mockResolvedValue(existingTransaction);
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        TransactionService.processWebhookNotificationService(
          "tx-123",
          "approved",
          "log-5",
          {
            transactionRepository: mockTxRepo,
            userRepository: mockUserRepo,
            firestoreBatch: mockBatch,
          },
        ),
      ).rejects.toThrow(UserNotFoundError);
    });

    it("lança erro se payer não for encontrado em failed", async () => {
      mockTxRepo.findTransactionById.mockResolvedValue(existingTransaction);
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        TransactionService.processWebhookNotificationService(
          "tx-123",
          "failed",
          "log-6",
          {
            transactionRepository: mockTxRepo,
            userRepository: mockUserRepo,
            firestoreBatch: mockBatch,
          },
        ),
      ).rejects.toThrow(UserNotFoundError);
    });

    it("lança erro se status for inválido", async () => {
      await expect(
        TransactionService.processWebhookNotificationService(
          "tx-123",
          "refunded" as any,
          "log-7",
          {
            transactionRepository: mockTxRepo,
            userRepository: mockUserRepo,
            firestoreBatch: mockBatch,
          },
        ),
      ).rejects.toThrow("Invalid newStatus. Must be 'approved' or 'failed'.");
    });
  });
});
