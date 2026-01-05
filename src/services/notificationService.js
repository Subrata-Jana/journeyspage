import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "./firebase";

// --- SEND NOTIFICATION (Generic) ---
// Valid types: 'alert', 'success', 'info', 'warning', 'social', 'comment'
export const sendNotification = async ({ recipientId, type, title, message, link }) => {
  try {
    await addDoc(collection(db, "notifications"), {
      recipientId, // 'admin', 'broadcast', or User UID
      type,        
      title,
      message,
      link,        
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
    // We have to batch these because 'in' query works on read, but write requires specific IDs.
    // So we fetch unread items for these IDs first.
    const q = query(
        collection(db, "notifications"), 
        where("recipientId", "in", recipientIds), 
        where("read", "==", false)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      batch.update(doc(db, "notifications", d.id), { read: true });
    });

    await batch.commit();
  } catch (error) {
    console.error("Error marking read:", error);
  }
};