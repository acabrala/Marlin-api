import { admin } from "../lib/admin";

const db = admin.firestore();
const webhookEventsCollection = db.collection("webhook_events");

export type WebhookProcessingStatus = "processed" | "failed" | "ignored";

export interface WebhookLogData {
  payload: unknown;
  receivedAt: admin.firestore.Timestamp;
  processingStatus?: WebhookProcessingStatus;
}

export const logWebhookEvent = async (payload: unknown): Promise<string> => {
  const logEntry: WebhookLogData = {
    payload,
    receivedAt: admin.firestore.Timestamp.now(),
  };

  try {
    const docRef = await webhookEventsCollection.add(logEntry);
    return docRef.id;
  } catch (error) {
    console.error("[Webhook] Error logging event:", error);
    throw new Error("Failed to log webhook event");
  }
};

export const updateWebhookEventStatus = async (
  docId: string,
  status: WebhookProcessingStatus,
): Promise<void> => {
  try {
    await webhookEventsCollection.doc(docId).update({ processingStatus: status });
  } catch (error) {
    console.error(`[Webhook] Failed to update status for ${docId}:`, error);
  }
};

export const findWebhookEventById = async (
  docId: string,
): Promise<WebhookLogData | null> => {
  try {
    const docSnap = await webhookEventsCollection.doc(docId).get();
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() as WebhookLogData;
  } catch (error) {
    console.error(`[Webhook] Failed to fetch event ${docId}:`, error);
    throw new Error("Failed to fetch webhook event");
  }
};

export const webhookRepository = {
  logWebhookEvent,
  updateWebhookEventStatus,
  findById: findWebhookEventById,
};
