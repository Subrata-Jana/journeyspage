import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "./firebase";

export const NOTIFICATION_CHANNELS = {
  ADMIN: "admin",
  BROADCAST: "broadcast",
};

export const getNotificationRecipientIds = (
  userId,
  { isAdmin = false, includeBroadcast = false } = {}
) => {
  if (!userId) return [];

  const ids = [userId];
  if (isAdmin) ids.push(NOTIFICATION_CHANNELS.ADMIN);
  if (includeBroadcast) ids.push(NOTIFICATION_CHANNELS.BROADCAST);
  return ids;
};

export const normalizeNotification = (note = {}) => ({
  ...note,
  type: note.type || "info",
  channel:
    note.channel ||
    (note.recipientId === NOTIFICATION_CHANNELS.ADMIN
      ? "admin"
      : note.recipientId === NOTIFICATION_CHANNELS.BROADCAST
        ? "broadcast"
        : "direct"),
  meta: note.meta || {},
  read: !!note.read,
});

export const sortNotificationsByDate = (notifications = []) =>
  [...notifications].sort(
    (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  );

export const sendNotification = async ({
  recipientId,
  type = "info",
  title,
  message,
  link = "",
  actorId = "",
  actorName = "",
  entityType = "",
  entityId = "",
  channel = "",
  meta = {},
}) => {
  try {
    await addDoc(collection(db, "notifications"), {
      recipientId,
      type,
      title,
      message,
      link,
      actorId,
      actorName,
      entityType,
      entityId,
      channel:
        channel ||
        (recipientId === NOTIFICATION_CHANNELS.ADMIN
          ? "admin"
          : recipientId === NOTIFICATION_CHANNELS.BROADCAST
            ? "broadcast"
            : "direct"),
      meta,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

// --- MARK ALL AS READ (Updated for Multi-Channel) ---
export const markAllAsRead = async (recipientIds) => {
  try {
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) return;

    const q = query(
        collection(db, "notifications"), 
        where("recipientId", "in", recipientIds), 
        where("read", "==", false)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    for (let offset = 0; offset < snapshot.docs.length; offset += 450) {
      const batch = writeBatch(db);
      snapshot.docs.slice(offset, offset + 450).forEach((d) => {
        batch.update(doc(db, "notifications", d.id), { read: true });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error("Error marking read:", error);
  }
};
