import { 
  doc, 
  runTransaction, 
  arrayUnion, 
  arrayRemove, 
  increment, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebase";
import { fetchGameRules, getCleanWallet, selectDailyReward } from "../utils/gameRules"; 

// --- DEFAULT CONFIGURATION ---
const DEFAULT_POINTS = {
  LIKE_GIVER: 5,
  LIKE_RECEIVER: 10,
  TRACK_GIVER: 10,
  TRACK_RECEIVER: 20,
  SHARE_GIVER: 20
};

// ======================================================
// 1. LIGHTWEIGHT ACTIONS
// ======================================================

export const toggleStoryLike = async (storyId, userId, authorId) => {
  const storyRef = doc(db, "stories", storyId);
  const userRef = doc(db, "users", userId);
  const authorRef = doc(db, "users", authorId);

  try {
    await runTransaction(db, async (transaction) => {
      const storyDoc = await transaction.get(storyRef);
      if (!storyDoc.exists()) throw "Story does not exist!";

      const likes = storyDoc.data().likes || [];
      const hasLiked = likes.includes(userId);

      if (hasLiked) {
        transaction.update(storyRef, { likes: arrayRemove(userId), likeCount: increment(-1) });
      } else {
        transaction.update(storyRef, { likes: arrayUnion(userId), likeCount: increment(1) });
        transaction.update(userRef, { xp: increment(DEFAULT_POINTS.LIKE_GIVER) });
        if (userId !== authorId) {
            transaction.update(authorRef, { xp: increment(DEFAULT_POINTS.LIKE_RECEIVER) });
        }
      }
    });
    return { success: true };
  } catch (e) {
    console.error("Like Error:", e);
    return { success: false, error: e };
  }
};

export const toggleUserTrack = async (targetUserId, currentUserId) => {
  const targetRef = doc(db, "users", targetUserId);
  const currentRef = doc(db, "users", currentUserId);

  try {
    await runTransaction(db, async (transaction) => {
      const targetDoc = await transaction.get(targetRef);
      if (!targetDoc.exists()) throw "User does not exist!";

      const trackers = targetDoc.data().trackers || [];
      const isTracking = trackers.includes(currentUserId);

      if (isTracking) {
        transaction.update(targetRef, { trackers: arrayRemove(currentUserId) });
        transaction.update(currentRef, { tracking: arrayRemove(targetUserId) });
      } else {
        transaction.update(targetRef, { trackers: arrayUnion(currentUserId), xp: increment(DEFAULT_POINTS.TRACK_RECEIVER) });
        transaction.update(currentRef, { tracking: arrayUnion(targetUserId), xp: increment(DEFAULT_POINTS.TRACK_GIVER) });
      }
    });
    return { success: true };
  } catch (e) {
    console.error("Track Error:", e);
    return { success: false, error: e };
  }
};

export const trackShare = async (storyId, userId) => {
  const storyRef = doc(db, "stories", storyId);
  const userRef = doc(db, "users", userId);

  try {
    await runTransaction(db, async (transaction) => {
      const storyDoc = await transaction.get(storyRef);
      if (!storyDoc.exists()) throw "Story missing";

      const sharedBy = storyDoc.data().sharedBy || [];
      if (sharedBy.includes(userId)) return;

      transaction.update(storyRef, { sharedBy: arrayUnion(userId), shareCount: increment(1) });
      transaction.update(userRef, { xp: increment(DEFAULT_POINTS.SHARE_GIVER) });
    });
    return { success: true };
  } catch (e) {
    console.error("Share Error:", e);
    return { success: false, error: e };
  }
};

// --- 🎒 COLLECT TREASURE (With Expiry) ---
export const collectLoot = async (userId, lootItem) => {
  try {
    const userRef = doc(db, "users", userId);
    
    const xpValue = parseInt(lootItem.points) || 50;
    const expiryHours = parseInt(lootItem.expiryHours || (lootItem.rarity === 'LEGENDARY' ? 720 : 24)); 
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const inventoryItem = {
        itemId: lootItem.id,
        name: lootItem.name,
        icon: lootItem.icon,
        rarity: lootItem.rarity,
        obtainedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
    };

    await updateDoc(userRef, {
      inventory: arrayUnion(inventoryItem),
      xp: increment(xpValue)
    });

    return { success: true, message: `Found: ${lootItem.name}`, xpGained: xpValue };
  } catch (error) {
    console.error("Loot error:", error);
    return { success: false, message: "Could not collect loot." };
  }
};

// ======================================================
// 🎁 SEND TRIBUTE (OPTIMIZED)
// ======================================================
// ⚠️ IMPORTANT: You must pass 'storyTitle' from the UI to avoid an extra DB Read.
export const sendTribute = async (senderId, authorId, storyId, item, message, storyTitle) => {
  const senderRef = doc(db, "users", senderId);
  const authorRef = doc(db, "users", authorId);
  const storyRef = doc(db, "stories", storyId);
  const notifRef = doc(collection(db, "notifications"));

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get Sender Data
      const senderDoc = await transaction.get(senderRef);
      if (!senderDoc.exists()) throw "User not found";
      const senderData = senderDoc.data();
      
      // FIX: Ensure we get a real name, fallback to "Unknown" only if absolutely necessary
      const senderName = senderData.displayName || senderData.name || "A Traveler";

      // ... (Keep existing Inventory/Trophy logic unchanged) ...
      const inventory = senderData.inventory || [];
      const itemIndex = inventory.findIndex(i => i.obtainedAt === item.obtainedAt && i.itemId === item.itemId);
      if (itemIndex === -1) throw "Item no longer exists in wallet";

      const authorDoc = await transaction.get(authorRef);
      if (!authorDoc.exists()) throw "Author not found";
      const authorData = authorDoc.data();
      let trophies = authorData.trophies || [];

      // Move Item Logic
      const newInventory = [...inventory];
      newInventory.splice(itemIndex, 1); 

      const trophyIndex = trophies.findIndex(t => t.name === item.name);
      if (trophyIndex > -1) {
        trophies[trophyIndex].count = (trophies[trophyIndex].count || 1) + 1;
      } else {
        trophies.push({
          name: item.name,
          icon: item.icon,
          rarity: item.rarity,
          count: 1
        });
      }

      // Writes
      transaction.update(senderRef, { inventory: newInventory, xp: increment(50) }); 
      transaction.update(authorRef, { trophies: trophies, xp: increment(100) });    
      transaction.update(storyRef, { tributeCount: increment(1) });

      // 6. CREATE NOTIFICATION (UPDATED)
      transaction.set(notifRef, {
        recipientId: authorId,
        senderId: senderId,
        senderName: senderName, // <--- SAVING NAME EXPLICITLY
        type: 'gift',
        itemName: item.name,
        itemIcon: item.icon,     
        itemRarity: item.rarity, 
        storyTitle: storyTitle || "a story",
        link: `/story/${storyId}`,
        
        // We still save a string message for fallback
        message: `${senderName} gifted you a ${item.name}!`,
        userNote: message,
        read: false,
        createdAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Tribute Error:", error);
    return { success: false, error: error.message || "Failed to send gift" };
  }
};

// ======================================================
// 🔄 DAILY SESSION MANAGER
// ======================================================
export const processUserSession = async (userId) => {
    const userRef = doc(db, "users", userId);
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) return;
            const userData = userDoc.data();
            const { loot } = await fetchGameRules();
            const { cleanInventory, hasChanges } = getCleanWallet(userData.inventory || []);
            
            let rewardMsg = null;
            const today = new Date().toISOString().split('T')[0];
            const lastLogin = userData.lastLoginDate || "";

            if (lastLogin !== today) {
                const reward = selectDailyReward(loot);
                if (reward) {
                    const expiryHours = reward.expiryHours || 24;
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + expiryHours);
                    cleanInventory.push({
                        itemId: reward.id,
                        name: reward.name,
                        icon: reward.icon,
                        rarity: reward.rarity,
                        obtainedAt: new Date().toISOString(),
                        expiresAt: expiresAt.toISOString(),
                        source: 'daily_login'
                    });
                    rewardMsg = reward.name;
                }
            }

            if (hasChanges || lastLogin !== today) {
                transaction.update(userRef, {
                    inventory: cleanInventory,
                    lastLoginDate: today,
                    ...(rewardMsg ? { xp: increment(10) } : {}) 
                });
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Session Process Error:", error);
        return { success: false };
    }
};

// ======================================================
// 🏆 MASTER ENGINE: SYNC
// ======================================================
// WARNING: This function reads ALL stories by an author.
// For large scale, consider moving this aggregation to a Cloud Function triggered on write.
export const syncUserGamification = async (userId) => {
  const userRef = doc(db, "users", userId);
  try {
    const { ranks, badges: badgeRules } = await fetchGameRules();
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw "User not found";
      const userData = userDoc.data();

      // PERFORMANCE NOTE: This query scales with the number of stories the user has.
      const storiesQ = query(collection(db, "stories"), where("authorId", "==", userId), where("status", "==", "approved"));
      const storiesSnap = await getDocs(storiesQ);
      
      let calculatedStats = { stories: storiesSnap.size, totalLikes: 0, totalShares: 0, uniquePlaces: new Set() };

      storiesSnap.forEach(doc => {
        const data = doc.data();
        calculatedStats.totalLikes += typeof data.likeCount === 'number' ? data.likeCount : (data.likes?.length || 0);
        calculatedStats.totalShares += typeof data.shareCount === 'number' ? data.shareCount : (data.sharedBy?.length || 0);
        if (data.locationData?.value?.place_id) calculatedStats.uniquePlaces.add(data.locationData.value.place_id);
        else if (data.location) calculatedStats.uniquePlaces.add(data.location.trim().toLowerCase());
      });

      let currentBadges = userData.badges || [];
      let newXP = userData.xp || 0;
      
      badgeRules.forEach(rule => {
        const alreadyUnlocked = currentBadges.some(b => b.id === rule.id && b.isUnlocked);
        const desc = (rule.description || "").toLowerCase();
        const name = (rule.name || "").toLowerCase();
        const threshold = parseInt(rule.value || rule.threshold || 0);
        
        let qualifies = false;
        if (desc.includes("like") || name.includes("like")) qualifies = calculatedStats.totalLikes >= threshold;
        else if (desc.includes("visit") || desc.includes("place") || name.includes("walker")) qualifies = calculatedStats.uniquePlaces.size >= threshold;
        else if (desc.includes("share") || name.includes("share")) qualifies = calculatedStats.totalShares >= threshold;
        else qualifies = calculatedStats.stories >= threshold;

        if (qualifies && !alreadyUnlocked) {
          newXP += 50; 
          currentBadges.push({
            id: rule.id, name: rule.name, icon: rule.icon, description: rule.description,
            color: rule.color, isUnlocked: true, unlockedAt: new Date().toISOString()
          });
        }
      });

      let eligibleRank = ranks.length > 0 ? ranks[0] : { name: "Tourist", minXP: 0 };
      for (let i = ranks.length - 1; i >= 0; i--) {
          if (newXP >= parseInt(ranks[i].threshold || ranks[i].minXP || 0)) { eligibleRank = ranks[i]; break; }
      }
      
      transaction.update(userRef, {
        xp: newXP, badges: currentBadges, currentRank: eligibleRank,
        stats: { stories: calculatedStats.stories, likes: calculatedStats.totalLikes, shares: calculatedStats.totalShares, places: calculatedStats.uniquePlaces.size }
      });
    });
    return { success: true };
  } catch (error) {
    console.error("Sync Error:", error);
    return { success: false, error };
  }
};