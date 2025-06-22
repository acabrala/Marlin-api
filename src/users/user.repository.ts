import { admin } from "../lib/admin";
import { User } from "../models";

const db = admin.firestore();
const usersCollection = db.collection("users");

const parseTimestamp = (ts: any): Date | null => {
  return ts?.toDate?.() ?? null;
};

const mapDocToUser = (doc: FirebaseFirestore.DocumentSnapshot): User => {
  const data = doc.data();
  if (!data) throw new Error("Document data undefined");

  return {
    user_id: doc.id,
    name: data.name,
    email: data.email,
    balance: data.balance,
    createdAt: parseTimestamp(data.createdAt),
    updatedAt: parseTimestamp(data.updatedAt),
  };
};

const findByEmail = async (email: string): Promise<User | null> => {
  try {
    const snapshot = await usersCollection
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    return mapDocToUser(snapshot.docs[0]);
  } catch (error) {
    console.error("UserRepository.findByEmail error:", error);
    throw error;
  }
};

const create = async (user: User): Promise<void> => {
  try {
    await usersCollection.doc(user.user_id).set(user);
  } catch (error) {
    console.error("UserRepository.create error:", error);
    throw error;
  }
};

const findById = async (id: string): Promise<User | null> => {
  try {
    const doc = await usersCollection.doc(id).get();
    if (!doc.exists) return null;
    return mapDocToUser(doc);
  } catch (error) {
    console.error("UserRepository.findById error:", error);
    throw error;
  }
};

const updateBalance = (
  batch: admin.firestore.WriteBatch,
  userId: string,
  newBalance: number,
): void => {
  const userRef = usersCollection.doc(userId);
  batch.update(userRef, {
    balance: newBalance,
    updatedAt: admin.firestore.Timestamp.now(),
  });
};

const update = async (
  id: string,
  data: Partial<Pick<User, "name" | "email">>,
): Promise<void> => {
  try {
    const updateData: Partial<Pick<User, "name" | "email">> & {
      updatedAt: admin.firestore.Timestamp;
    } = {
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;

    await usersCollection.doc(id).update(updateData);
  } catch (error) {
    console.error("UserRepository.update error:", error);
    throw error;
  }
};

const listAll = async (): Promise<User[]> => {
  try {
    const snapshot = await usersCollection.get();
    return snapshot.docs.map(mapDocToUser);
  } catch (error) {
    console.error("UserRepository.listAll error:", error);
    throw error;
  }
};

export const userRepository = {
  findByEmail,
  findById,
  create,
  update,
  updateBalance,
  listAll,
};

export type UserRepository = typeof userRepository;
