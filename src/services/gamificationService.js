import { doc, runTransaction, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { db } from "./firebase";

// --- CONFIGURATION (Or fetch from Admin Panel) ---
const POINTS = {
  LIKE_GIVER: 5,    // Points for liking a story
  LIKE_RECEIVER: 10,// Points for receiving a like
  TRACK_GIVER: 10,  // Points for following someone
  TRACK_RECEIVER: 20// Points for gaining a follower
};

// --- HANDLE LIKE ---
export const toggleStoryLike = async (storyId, userId, authorId) => {
  const storyRef = doc(db, "stories", storyId);
  const userRef = doc(db, "users", userId);     // The Reader
  const authorRef = doc(db, "users", authorId); // The Writer

  try {
    await runTransaction(db, async (transaction) => {
      const storyDoc = await transaction.get(storyRef);
      if (!storyDoc.exists()) throw "Story does not exist!";

      const likes = storyDoc.data().likes || [];
      const hasLiked = likes.includes(userId);

      if (hasLiked) {
        // UNLIKE: Remove ID, Decrement Count, NO XP Change (Don't punish)
        transaction.update(storyRef, {
          likes: arrayRemove(userId),
          likeCount: increment(-1)
        });
      } else {
        // LIKE: Add ID, Increment Count, AWARD XP
        transaction.update(storyRef, {
          likes: arrayUnion(userId),
          likeCount: increment(1)
        });

        // 1. Reward the Reader (Activity Bonus)
        transaction.update(userRef, { xp: increment(POINTS.LIKE_GIVER) });

        // 2. Reward the Author (Quality Bonus)
        // Check to prevent self-liking abuse
        if (userId !== authorId) {
            transaction.update(authorRef, { xp: increment(POINTS.LIKE_RECEIVER) });
        }
      }
    });
    return { success: true };
  } catch (e) {
    console.error("Like Error:", e);
    return { success: false, error: e };
  }
};

// --- HANDLE TRACK (FOLLOW) ---
export const toggleUserTrack = async (targetUserId, currentUserId) => {
  const targetRef = doc(db, "users", targetUserId); // Person being followed
  const currentRef = doc(db, "users", currentUserId); // Person following

  try {
    await runTransaction(db, async (transaction) => {
      const targetDoc = await transaction.get(targetRef);
      if (!targetDoc.exists()) throw "User does not exist!";

      const trackers = targetDoc.data().trackers || [];
      const isTracking = trackers.includes(currentUserId);

      if (isTracking) {
        // UNTRACK
        transaction.update(targetRef, { trackers: arrayRemove(currentUserId) });
        transaction.update(currentRef, { tracking: arrayRemove(targetUserId) });
      } else {
        // TRACK & AWARD XP
        transaction.update(targetRef, { 
            trackers: arrayUnion(currentUserId),
            xp: increment(POINTS.TRACK_RECEIVER) // Reward for being interesting
        });
        transaction.update(currentRef, { 
            tracking: arrayUnion(targetUserId),
            xp: increment(POINTS.TRACK_GIVER) // Reward for networking
        });
      }
    });
    return { success: true };
  } catch (e) {
    console.error("Track Error:", e);
    return { success: false, error: e };
  }
};