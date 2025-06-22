const mockRunTransaction = jest.fn();
const mockBatch = {
  commit: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

const mockTimestamp = {
  now: jest.fn(() => {
    const date = new Date("2023-01-01T12:00:00.000Z");
    return {
      _seconds: Math.floor(date.getTime() / 1000),
      _nanoseconds: 0,
      toDate: () => date,
    };
  }),
  fromDate: (date: any) => ({
    _seconds: Math.floor(date.getTime() / 1000),
    _nanoseconds: 0,
    toDate: () => date,
  }),
};

function firestore() {
  return {
    runTransaction: mockRunTransaction.mockImplementation(async (updateFunction) => {
      return updateFunction({} as any);
    }),
    batch: () => mockBatch,
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      })),
      where: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    })),
    Timestamp: mockTimestamp,
  };
}

firestore.Timestamp = mockTimestamp;

module.exports = {
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  apps: [],
  firestore,
};
