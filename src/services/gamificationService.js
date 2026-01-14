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

// ======================================================
// 1. SOCIAL ACTIONS
// ======================================================

export const toggleStoryLike = async (storyId, userId, authorId) => {
  const storyRef = doc(db, "stories", storyId);
  const userRef = doc(db, "users", userId);
  const authorRef = doc(db, "users", authorId);

  try {
    await runTransaction(db, async (transaction) => {
      const storyDoc = await transaction.get(storyRef);
      if (!storyDoc.exists()) throw "Story missing";

      const likes = storyDoc.data().likes || [];
      const hasLiked = likes.includes(userId);

      if (hasLiked) {
        transaction.update(storyRef, { likes: arrayRemove(userId), likeCount: increment(-1) });
      } else {
        transaction.update(storyRef, { likes: arrayUnion(userId), likeCount: increment(1) });
        // Give Points
        transaction.update(userRef, { xp: increment(POINTS.LIKE_GIVE) });
        if (userId !== authorId) {
            transaction.update(authorRef, { xp: increment(POINTS.LIKE_RECEIVE) });
        }
      }
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
};

export const toggleUserTrack = async (targetUserId, currentUserId) => {
  const targetRef = doc(db, "users", targetUserId);
  const currentRef = doc(db, "users", currentUserId);

  try {
    await runTransaction(db, async (transaction) => {
      const targetDoc = await transaction.get(targetRef);
      if (!targetDoc.exists()) throw "User missing";

      const trackers = targetDoc.data().trackers || [];
      const isTracking = trackers.includes(currentUserId);

      if (isTracking) {
        transaction.update(targetRef, { trackers: arrayRemove(currentUserId) });
        transaction.update(currentRef, { tracking: arrayRemove(targetUserId) });
      } else {
        transaction.update(targetRef, { trackers: arrayUnion(currentUserId), xp: increment(POINTS.TRACK_RECEIVER) });
        transaction.update(currentRef, { tracking: arrayUnion(targetUserId), xp: increment(POINTS.TRACK_GIVER) });
      }
    });
    return { success: true };
  } catch (e) {
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
      transaction.update(userRef, { xp: increment(POINTS.SHARE_GIVER) });
    });
    return { success: true };
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
// 🎁 SEND TRIBUTE (Using Admin Panel Rarity)
// ======================================================
export const sendTribute = async (senderId, authorId, storyId, item, message, storyTitle) => {
  if (senderId === authorId) return { success: false, error: "Cannot gift yourself" };

  const senderRef = doc(db, "users", senderId);
  const authorRef = doc(db, "users", authorId);
  const storyRef = doc(db, "stories", storyId);
  const notifRef = doc(collection(db, "notifications"));

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get Sender
      const senderDoc = await transaction.get(senderRef);
      const senderData = senderDoc.data();
      const inventory = senderData.inventory || [];
      const senderName = senderData.displayName || senderData.name || "A Traveler";
      
      const itemIndex = inventory.findIndex(i => i.obtainedAt === item.obtainedAt && i.itemId === item.itemId);
      if (itemIndex === -1) throw "Item expired or missing";

      // 2. Determine Value based on Admin Panel Rarity
      const rarityUpper = (item.rarity || "COMMON").toUpperCase();
      const baseValue = POINTS.RARITY_MULTIPLIER[rarityUpper] || 10;
      
      const senderXP = Math.floor(baseValue * POINTS.GIFT_SENDER_RATIO);
      const authorXP = Math.floor(baseValue * POINTS.GIFT_RECEIVER_RATIO);

      // 3. Move Item
      const newInventory = [...inventory];
      newInventory.splice(itemIndex, 1);

      const authorDoc = await transaction.get(authorRef);
      const authorData = authorDoc.data();
      let trophies = authorData.trophies || [];
      
      const trophyIdx = trophies.findIndex(t => t.name === item.name);
      if (trophyIdx > -1) {
        trophies[trophyIdx].count = (trophies[trophyIdx].count || 1) + 1;
      } else {
        trophies.push({ name: item.name, icon: item.icon, rarity: item.rarity, count: 1 });
      }

      // 4. Writes
      transaction.update(senderRef, { inventory: newInventory, xp: increment(senderXP) }); 
      transaction.update(authorRef, { trophies: trophies, xp: increment(authorXP) });    
      transaction.update(storyRef, { giftCount: increment(1), tributeCount: increment(1) }); 

      // 5. Notification
      transaction.set(notifRef, {
        recipientId: authorId,
        senderId: senderId,
        senderName: senderName,
        type: 'gift',
        itemName: item.name,
        itemIcon: item.icon,     
        itemRarity: item.rarity, 
        storyTitle: storyTitle,
        link: `/story/${storyId}`,
        message: `${senderName} sent you a ${item.rarity} ${item.name}!`,
        userNote: message,
        read: false,
        createdAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ======================================================
// 🔄 DAILY SESSION MANAGER
// ======================================================
export const processUserSession = async (userId) => {
    const userRef = doc(db, "users", userId);
    try {
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(userRef);
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            
            const today = new Date().toISOString().split('T')[0];
            if (data.lastLoginDate !== today) {
                // ⚡ Fetch Dynamic Loot Table from Admin Panel
                const { loot } = await fetchGameRules();
                const reward = selectDailyReward(loot);
                
                t.update(userRef, {
                    lastLoginDate: today,
                    xp: increment(20), // Daily Login
                });
                
                if (reward) {
                    const expiryHours = parseInt(reward.expiryHours || 24);
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + expiryHours);
                    
                    t.update(userRef, {
                        inventory: arrayUnion({
                            itemId: reward.id,
                            name: reward.name,
                            icon: reward.icon,
                            rarity: reward.rarity,
                            obtainedAt: new Date().toISOString(),
                            expiresAt: expiresAt.toISOString(),
                            source: 'daily_login'
                        })
                    });
                }
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
    
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw "User not found";
      const userData = userDoc.data();

      // ... (Stats Calculation Logic Same as Before) ...
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
      let eligibleRank = ranks.length > 0 ? ranks[0] : { name: "Tourist", minXP: 0 };
      // Sort ranks descending by threshold to find highest match
      const sortedRanks = [...ranks].sort((a,b) => (a.threshold || 0) - (b.threshold || 0));
      
      for (let i = sortedRanks.length - 1; i >= 0; i--) {
        const r = sortedRanks[i];
        const thresh = parseInt(r.threshold || r.minXP || 0);
        if (newXP >= thresh) { eligibleRank = r; break; }
      }
      
      transaction.update(userRef, {
        xp: newXP, badges: currentBadges, currentRank: eligibleRank,
        stats: { stories: calculatedStats.stories, likes: calculatedStats.totalLikes, shares: calculatedStats.totalShares, places: calculatedStats.uniquePlaces.size }
      });
    });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};