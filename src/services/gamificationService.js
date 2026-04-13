import { 
  doc, 
  runTransaction, 
  arrayUnion, 
  arrayRemove, 
  increment,
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  writeBatch 
} from "firebase/firestore";
import { db } from "./firebase";
import { fetchGameRules, getCleanWallet, selectDailyReward, calculateRank } from "../utils/gameRules"; 

// ======================================================
// 📊 BASE CONFIGURATION (Defaults)
// ======================================================
// These are used if dynamic data is missing or for standard actions
const POINTS = {
  LIKE_GIVE: 2,       
  LIKE_RECEIVE: 10,   
  TRACK_GIVER: 5,
  TRACK_RECEIVER: 15, 
  SHARE_GIVER: 20, 
  
  // ⚡ DYNAMIC RARITY VALUES
  // Since your Admin Panel sets "Rarity", we use that to determine value
  RARITY_MULTIPLIER: {
    COMMON: 10,
    UNCOMMON: 50,
    RARE: 100,      // Just in case you add 'Rare' later
    LEGENDARY: 500
  },

  // XP for sending a gift vs receiving it
  GIFT_SENDER_RATIO: 0.2, // Sender gets 20% of value (e.g. 100 XP for Legendary)
  GIFT_RECEIVER_RATIO: 1.0 // Receiver gets 100% of value (e.g. 500 XP)
};

// 📈 LEVELING FORMULA
export const calculateLevel = (xp) => {
  if (!xp || xp < 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

const getXpValue = (value) => Number(value || 0);

const getResolvedRank = (ranks = [], xp = 0) => {
  if (!Array.isArray(ranks) || ranks.length === 0) return null;
  return calculateRank(ranks, xp);
};

const buildXpRankPatch = (userData = {}, xpDelta = 0, ranks = []) => {
  const nextXp = getXpValue(userData.xp) + xpDelta;
  const nextRank = getResolvedRank(ranks, nextXp);

  return {
    xp: increment(xpDelta),
    ...(nextRank ? { currentRank: nextRank } : {}),
  };
};

const buildAbsoluteXpRankPatch = (nextXp = 0, ranks = [], extraData = {}) => {
  const nextRank = getResolvedRank(ranks, nextXp);
  return {
    ...extraData,
    xp: nextXp,
    ...(nextRank ? { currentRank: nextRank } : {}),
  };
};

// ======================================================
// 1. SOCIAL ACTIONS
// ======================================================

export const toggleStoryLike = async (storyId, userId, authorId) => {
  const storyRef = doc(db, "stories", storyId);
  const userRef = doc(db, "users", userId);
  const authorRef = doc(db, "users", authorId);
  const { ranks } = await fetchGameRules();
  let addedLike = false;

  try {
    await runTransaction(db, async (transaction) => {
      const storyDoc = await transaction.get(storyRef);
      if (!storyDoc.exists()) throw new Error("Story missing");

      const likes = storyDoc.data().likes || [];
      const hasLiked = likes.includes(userId);

      if (hasLiked) {
        transaction.update(storyRef, { likes: arrayRemove(userId), likeCount: increment(-1) });
      } else {
        const userDoc = await transaction.get(userRef);
        transaction.update(storyRef, { likes: arrayUnion(userId), likeCount: increment(1) });
        if (userDoc.exists()) {
          transaction.update(userRef, buildXpRankPatch(userDoc.data(), POINTS.LIKE_GIVE, ranks));
        }

        if (userId !== authorId) {
            const authorDoc = await transaction.get(authorRef);
            if (authorDoc.exists()) {
              transaction.update(authorRef, buildXpRankPatch(authorDoc.data(), POINTS.LIKE_RECEIVE, ranks));
            }
        }

        addedLike = true;
      }
    });

    if (addedLike && userId !== authorId) {
      void syncUserGamification(authorId);
    }

    return { success: true, addedLike, xpGained: addedLike ? POINTS.LIKE_GIVE : 0 };
  } catch (e) {
    return { success: false, error: e };
  }
};

export const toggleUserTrack = async (targetUserId, currentUserId) => {
  const targetRef = doc(db, "users", targetUserId);
  const currentRef = doc(db, "users", currentUserId);
  const { ranks } = await fetchGameRules();
  let isNowTracking = false;
  let xpGained = 0;

  try {
    await runTransaction(db, async (transaction) => {
      const [targetDoc, currentDoc] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(currentRef),
      ]);
      if (!targetDoc.exists() || !currentDoc.exists()) throw new Error("User missing");

      const trackers = targetDoc.data().trackers || [];
      const isTracking = trackers.includes(currentUserId);
      const trackersCount = Number(targetDoc.data().trackersCount || trackers.length || 0);

      if (isTracking) {
        transaction.update(targetRef, {
          trackers: arrayRemove(currentUserId),
          trackersCount: Math.max(0, trackersCount - 1),
        });
        transaction.update(currentRef, { tracking: arrayRemove(targetUserId) });
      } else {
        transaction.update(targetRef, {
          trackers: arrayUnion(currentUserId),
          trackersCount: trackersCount + 1,
          ...buildXpRankPatch(targetDoc.data(), POINTS.TRACK_RECEIVER, ranks),
        });
        transaction.update(currentRef, {
          tracking: arrayUnion(targetUserId),
          ...buildXpRankPatch(currentDoc.data(), POINTS.TRACK_GIVER, ranks),
        });
        isNowTracking = true;
        xpGained = POINTS.TRACK_GIVER;
      }
    });
    return { success: true, isTracking: isNowTracking, xpGained };
  } catch (e) {
    return { success: false, error: e };
  }
};

export const trackShare = async (storyId, userId, authorId = null) => {
  const storyRef = doc(db, "stories", storyId);
  const userRef = doc(db, "users", userId);
  const { ranks } = await fetchGameRules();
  let shared = false;

  try {
    await runTransaction(db, async (transaction) => {
      const [storyDoc, userDoc] = await Promise.all([
        transaction.get(storyRef),
        transaction.get(userRef),
      ]);
      if (!storyDoc.exists() || !userDoc.exists()) throw new Error("Story missing");
      const sharedBy = storyDoc.data().sharedBy || [];
      if (sharedBy.includes(userId)) return;

      transaction.update(storyRef, { sharedBy: arrayUnion(userId), shareCount: increment(1) });
      transaction.update(userRef, buildXpRankPatch(userDoc.data(), POINTS.SHARE_GIVER, ranks));
      shared = true;
    });

    if (shared && authorId && authorId !== userId) {
      void syncUserGamification(authorId);
    }

    return {
      success: true,
      shared,
      alreadyShared: !shared,
      xpGained: shared ? POINTS.SHARE_GIVER : 0,
    };
  } catch (e) {
    return { success: false, error: e };
  }
};

// ======================================================
// 🎒 COLLECT TREASURE (Connected to Admin Panel)
// ======================================================
export const collectLoot = async (userId, lootItem) => {
  try {
    const userRef = doc(db, "users", userId);
    const { ranks } = await fetchGameRules();
    
    // ⚡ DYNAMIC XP LOGIC:
    // 1. Check if 'points' is set in Admin Panel (Best)
    // 2. Else, calculate based on Rarity (Fallback)
    let xpValue = 0;
    
    if (lootItem.points) {
        // Use value from Admin Panel
        xpValue = parseInt(lootItem.points);
    } else {
        // Fallback to Rarity System
        const rarityUpper = (lootItem.rarity || "COMMON").toUpperCase();
        xpValue = POINTS.RARITY_MULTIPLIER[rarityUpper] || 10;
    }

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

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User missing");

      const userData = userDoc.data();
      const { cleanInventory } = getCleanWallet(userData.inventory || []);
      const nextInventory = [...cleanInventory, inventoryItem];
      const nextXp = getXpValue(userData.xp) + xpValue;

      transaction.update(
        userRef,
        buildAbsoluteXpRankPatch(nextXp, ranks, {
          inventory: nextInventory,
        })
      );
    });

    return { success: true, message: `Found: ${lootItem.name}`, xpGained: xpValue };
  } catch (error) {
    console.error("Loot error:", error);
    return { success: false, message: "Could not collect loot." };
  }
};

// ======================================================
// 🎁 SEND TRIBUTE (Using Admin Panel Rarity)
// ======================================================
export const sendTribute = async (senderId, authorId, storyId, item, message, storyTitle) => {
  if (senderId === authorId) return { success: false, error: "Cannot gift yourself" };

  const senderRef = doc(db, "users", senderId);
  const authorRef = doc(db, "users", authorId);
  const storyRef = doc(db, "stories", storyId);
  const notifRef = doc(collection(db, "notifications"));
  const { ranks } = await fetchGameRules();

  try {
    await runTransaction(db, async (transaction) => {
      const [senderDoc, authorDoc] = await Promise.all([
        transaction.get(senderRef),
        transaction.get(authorRef),
      ]);
      if (!senderDoc.exists() || !authorDoc.exists()) throw new Error("User missing");

      const senderData = senderDoc.data();
      const inventory = senderData.inventory || [];
      const senderName = senderData.displayName || senderData.name || "A Traveler";
      
      const itemIndex = inventory.findIndex(i => i.obtainedAt === item.obtainedAt && i.itemId === item.itemId);
      if (itemIndex === -1) throw new Error("Item expired or missing");

      // 2. Determine Value based on Admin Panel Rarity
      const rarityUpper = (item.rarity || "COMMON").toUpperCase();
      const baseValue = POINTS.RARITY_MULTIPLIER[rarityUpper] || 10;
      
      const senderXP = Math.floor(baseValue * POINTS.GIFT_SENDER_RATIO);
      const authorXP = Math.floor(baseValue * POINTS.GIFT_RECEIVER_RATIO);

      // 3. Move Item
      const newInventory = [...inventory];
      newInventory.splice(itemIndex, 1);

      const authorData = authorDoc.data();
      let trophies = authorData.trophies || [];
      
      const trophyIdx = trophies.findIndex(t => t.name === item.name);
      if (trophyIdx > -1) {
        trophies[trophyIdx].count = (trophies[trophyIdx].count || 1) + 1;
      } else {
        trophies.push({ name: item.name, icon: item.icon, rarity: item.rarity, count: 1 });
      }

      // 4. Writes
      transaction.update(senderRef, {
        inventory: newInventory,
        ...buildXpRankPatch(senderData, senderXP, ranks),
      });
      transaction.update(authorRef, {
        trophies,
        ...buildXpRankPatch(authorData, authorXP, ranks),
      });
      transaction.update(storyRef, { giftCount: increment(1), tributeCount: increment(1) }); 

      // 5. Notification
      transaction.set(notifRef, {
        recipientId: authorId,
        actorId: senderId,
        actorName: senderName,
        senderId: senderId,
        senderName: senderName,
        type: 'gift',
        channel: 'social',
        entityType: 'story',
        entityId: storyId,
        itemName: item.name,
        itemIcon: item.icon,     
        itemRarity: item.rarity, 
        storyTitle: storyTitle,
        link: `/story/${storyId}`,
        message: `${senderName} sent you a ${item.rarity} ${item.name}!`,
        userNote: message,
        meta: {
          storyId,
          storyTitle,
          senderXP,
          authorXP,
        },
        read: false,
        createdAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
};

// ======================================================
// 🔄 DAILY SESSION MANAGER
// ======================================================
export const processUserSession = async (userId) => {
    const userRef = doc(db, "users", userId);
    try {
        const { loot, ranks } = await fetchGameRules();
        const reward = selectDailyReward(loot);
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(userRef);
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            
            const today = new Date().toISOString().split('T')[0];
            if (data.lastLoginDate !== today) {
                // ⚡ Fetch Dynamic Loot Table from Admin Panel
                const { cleanInventory } = getCleanWallet(data.inventory || []);
                const nextInventory = [...cleanInventory];
                
                if (reward) {
                    const expiryHours = parseInt(reward.expiryHours || 24);
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + expiryHours);
                    
                    nextInventory.push({
                        itemId: reward.id,
                        name: reward.name,
                        icon: reward.icon,
                        rarity: reward.rarity,
                        obtainedAt: new Date().toISOString(),
                        expiresAt: expiresAt.toISOString(),
                        source: 'daily_login'
                    });
                }

                const nextXp = getXpValue(data.xp) + 20;
                t.update(
                    userRef,
                    buildAbsoluteXpRankPatch(nextXp, ranks, {
                        lastLoginDate: today,
                        inventory: nextInventory,
                    })
                );
            }
        });
        return { success: true };
    } catch (error) { return { success: false }; }
};

// ======================================================
// 🏆 MASTER SYNC (Uses Admin Panel Rules)
// ======================================================
export const syncUserGamification = async (userId) => {
  const userRef = doc(db, "users", userId);
  try {
    // ⚡ FETCH DYNAMIC RULES FROM ADMIN PANEL
    const { ranks, badges: badgeRules } = await fetchGameRules();
    const storiesQ = query(collection(db, "stories"), where("authorId", "==", userId), where("status", "==", "approved"));
    const storiesSnap = await getDocs(storiesQ);
    let nextAuthorRank = null;
    let nextAuthorPhoto = "";

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User not found");
      const userData = userDoc.data();
      
      let calculatedStats = { stories: storiesSnap.size, totalLikes: 0, totalShares: 0, uniquePlaces: new Set() };
      storiesSnap.forEach((storyDoc) => {
        const data = storyDoc.data();
        calculatedStats.totalLikes += typeof data.likeCount === 'number' ? data.likeCount : (data.likes?.length || 0);
        calculatedStats.totalShares += typeof data.shareCount === 'number' ? data.shareCount : (data.sharedBy?.length || 0);
        if (data.locationData?.value?.place_id) calculatedStats.uniquePlaces.add(data.locationData.value.place_id);
        else if (data.location) calculatedStats.uniquePlaces.add(data.location.trim().toLowerCase());
      });

      let currentBadges = userData.badges || [];
      let newXP = getXpValue(userData.xp);
      const { cleanInventory } = getCleanWallet(userData.inventory || []);
      
      // ⚡ DYNAMIC BADGES: Use 'value' or 'threshold' from Admin Panel
      badgeRules.forEach(rule => {
        const alreadyUnlocked = currentBadges.some(b => b.id === rule.id && b.isUnlocked);
        const name = (rule.name || "").toLowerCase();
        const desc = (rule.description || "").toLowerCase();
        const threshold = parseInt(rule.value || rule.threshold || 0);
        
        let qualifies = false;
        if (desc.includes("like") || name.includes("like")) qualifies = calculatedStats.totalLikes >= threshold;
        else if (desc.includes("visit") || desc.includes("place")) qualifies = calculatedStats.uniquePlaces.size >= threshold;
        else if (desc.includes("share") || name.includes("share")) qualifies = calculatedStats.totalShares >= threshold;
        else qualifies = calculatedStats.stories >= threshold;

        if (qualifies && !alreadyUnlocked) {
          newXP += 250; 
          currentBadges.push({
            id: rule.id, name: rule.name, icon: rule.icon, description: rule.description,
            color: rule.color, isUnlocked: true, unlockedAt: new Date().toISOString()
          });
        }
      });

      // ⚡ DYNAMIC RANKS: Use 'threshold' from Admin Panel
      const eligibleRank = getResolvedRank(ranks, newXP);
      nextAuthorRank =
        eligibleRank?.name ||
        (typeof userData?.currentRank === "string" ? userData.currentRank : userData?.currentRank?.name) ||
        "Scout";
      nextAuthorPhoto =
        userData.photoURL ||
        userData.avatarUrl ||
        userData.profilePhoto ||
        userData.avatar ||
        "";
      transaction.update(userRef, {
        xp: newXP, badges: currentBadges, ...(eligibleRank ? { currentRank: eligibleRank } : {}), inventory: cleanInventory,
        stats: { stories: calculatedStats.stories, likes: calculatedStats.totalLikes, shares: calculatedStats.totalShares, places: calculatedStats.uniquePlaces.size }
      });
    });

    if (!storiesSnap.empty) {
      const batch = writeBatch(db);
      let hasStoryUpdates = false;

      storiesSnap.forEach((storyDoc) => {
        const storyData = storyDoc.data();
        const storyPatch = {};

        if (nextAuthorRank && storyData.authorRank !== nextAuthorRank) {
          storyPatch.authorRank = nextAuthorRank;
        }

        if (nextAuthorPhoto && storyData.authorPhoto !== nextAuthorPhoto) {
          storyPatch.authorPhoto = nextAuthorPhoto;
        }

        if (Object.keys(storyPatch).length > 0) {
          batch.update(storyDoc.ref, storyPatch);
          hasStoryUpdates = true;
        }
      });

      if (hasStoryUpdates) {
        await batch.commit();
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};
