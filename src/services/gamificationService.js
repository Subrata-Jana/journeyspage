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
  getDoc 
} from "firebase/firestore";
import { db } from "./firebase";

// --- DEFAULT CONFIGURATION (Fallback if DB is empty) ---
const DEFAULT_POINTS = {
  LIKE_GIVER: 5,
  LIKE_RECEIVER: 10,
  TRACK_GIVER: 10,
  TRACK_RECEIVER: 20,
  SHARE_GIVER: 20
};

// --- HELPER: FETCH DYNAMIC RULES FROM ADMIN PANEL DATA ---
const fetchGameRules = async () => {
  try {
    // 1. Fetch Ranks and Badges in parallel
    const [ranksSnap, badgesSnap] = await Promise.all([
      getDoc(doc(db, "meta", "ranks")),
      getDoc(doc(db, "meta", "badges"))
    ]);

    // 2. Parse Ranks (Sort by Threshold/XP Ascending)
    const ranks = ranksSnap.exists() 
      ? (ranksSnap.data().items || []).sort((a, b) => parseInt(a.threshold) - parseInt(b.threshold))
      : [];

    // 3. Parse Badges
    const badges = badgesSnap.exists() 
      ? (badgesSnap.data().items || []) 
      : [];

    return { ranks, badges };
  } catch (error) {
    console.error("Error fetching game rules:", error);
    // Return empty arrays so the app doesn't crash, logic will just skip updates
    return { ranks: [], badges: [] };
  }
};

// ======================================================
// 1. LIGHTWEIGHT ACTIONS (Fast & Cheap)
// ======================================================

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
        // UNLIKE: Remove ID, Decrement Count
        transaction.update(storyRef, {
          likes: arrayRemove(userId),
          likeCount: increment(-1)
        });
        // We generally don't deduct XP for unliking to prevent "XP bouncing" confusion
      } else {
        // LIKE: Add ID, Increment Count, AWARD XP
        transaction.update(storyRef, {
          likes: arrayUnion(userId),
          likeCount: increment(1)
        });

        // 1. Reward the Reader
        transaction.update(userRef, { xp: increment(DEFAULT_POINTS.LIKE_GIVER) });

        // 2. Reward the Author (Prevent self-liking abuse)
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
            xp: increment(DEFAULT_POINTS.TRACK_RECEIVER) 
        });
        transaction.update(currentRef, { 
            tracking: arrayUnion(targetUserId),
            xp: increment(DEFAULT_POINTS.TRACK_GIVER) 
        });
      }
    });
    return { success: true };
  } catch (e) {
    console.error("Track Error:", e);
    return { success: false, error: e };
  }
};

// --- HANDLE SHARE (SECURE) ---
export const trackShare = async (storyId, userId) => {
  const storyRef = doc(db, "stories", storyId);
  const userRef = doc(db, "users", userId);

  try {
    await runTransaction(db, async (transaction) => {
      const storyDoc = await transaction.get(storyRef);
      if (!storyDoc.exists()) throw "Story missing";

      // 1. Check if already shared by this user
      const sharedBy = storyDoc.data().sharedBy || [];
      if (sharedBy.includes(userId)) {
        return; // STOP! User already shared this. No points.
      }

      // 2. If new share: Add ID, Increment Count
      transaction.update(storyRef, {
        sharedBy: arrayUnion(userId),
        shareCount: increment(1)
      });
      
      // 3. Give points to the SHARER
      transaction.update(userRef, {
        xp: increment(DEFAULT_POINTS.SHARE_GIVER) 
      });
    });
    return { success: true };
  } catch (e) {
    console.error("Share Error:", e);
    return { success: false, error: e };
  }
};

// --- COLLECT TREASURE / HEIRLOOM ---
export const collectLoot = async (userId, lootItem) => {
  try {
    const userRef = doc(db, "users", userId);
    
    // We default to 50 XP if 'points' isn't defined on the item
    const xpValue = parseInt(lootItem.points) || 50;

    await updateDoc(userRef, {
      inventory: arrayUnion(lootItem.id), // Unlock in Profile
      xp: increment(xpValue)              // Level Up!
    });

    return { success: true, message: `You found: ${lootItem.name}`, xpGained: xpValue };
  } catch (error) {
    console.error("Loot error:", error);
    return { success: false, message: "Could not collect loot." };
  }
};


// ======================================================
// 🏆 THE DYNAMIC ENGINE: SYNC EVERYTHING
// This reads rules from DB (Admin Panel), interprets them, 
// and updates the user's Ranks/Badges automatically.
// Run this on critical events (Publishing, Profile Edit).
// ======================================================
export const syncUserGamification = async (userId) => {
  const userRef = doc(db, "users", userId);

  try {
    // 1. Fetch Dynamic Rules from DB (Ranks & Badges from Admin Panel)
    const { ranks, badges: badgeRules } = await fetchGameRules();

    await runTransaction(db, async (transaction) => {
      // 2. Fetch User Data
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw "User not found";
      const userData = userDoc.data();

      // 3. Fetch & Calculate Stats (The Source of Truth)
      //    We aggregate data from all their approved stories
      const storiesQ = query(
        collection(db, "stories"), 
        where("authorId", "==", userId), 
        where("status", "==", "approved")
      );
      const storiesSnap = await getDocs(storiesQ);
      
      let calculatedStats = {
        stories: storiesSnap.size,
        totalLikes: 0,
        totalShares: 0,
        uniquePlaces: new Set()
      };

      storiesSnap.forEach(doc => {
        const data = doc.data();
        
        // Sum Likes (Handle Array vs Number)
        const likes = typeof data.likeCount === 'number' 
            ? data.likeCount : (data.likes?.length || 0);
        calculatedStats.totalLikes += likes;

        // Sum Shares (Handle Array vs Number)
        const shares = typeof data.shareCount === 'number' 
            ? data.shareCount : (data.sharedBy?.length || 0);
        calculatedStats.totalShares += shares;
        
        // Count Unique Places
        if (data.locationData?.value?.place_id) {
            calculatedStats.uniquePlaces.add(data.locationData.value.place_id);
        } else if (data.location) {
            calculatedStats.uniquePlaces.add(data.location.trim().toLowerCase());
        }
      });

      const uniquePlacesCount = calculatedStats.uniquePlaces.size;

      // 4. 🛡️ DYNAMIC BADGE LOGIC (The Interpreter)
      //    We map the Admin Panel rules to real stats here.
      let currentBadges = userData.badges || [];
      let newXP = userData.xp || 0;
      let hasUpdates = false;

      // Loop through the rules fetched from DB
      badgeRules.forEach(rule => {
        // Does user already have it?
        const alreadyUnlocked = currentBadges.some(b => b.id === rule.id && b.isUnlocked);
        
        // INTERPRET CONDITION based on Description or Keywords
        // (Since Admin Panel is generic, we detect logic from text)
        const desc = (rule.description || "").toLowerCase();
        const name = (rule.name || "").toLowerCase();
        const threshold = parseInt(rule.value || rule.threshold || 0);
        
        let qualifies = false;

        if (desc.includes("like") || name.includes("like")) {
           // ❤️ Likes Trigger
           qualifies = calculatedStats.totalLikes >= threshold;
        } 
        else if (desc.includes("visit") || desc.includes("place") || name.includes("walker")) {
           // 🌍 Places Trigger
           qualifies = uniquePlacesCount >= threshold;
        }
        else if (desc.includes("share") || name.includes("share")) {
           // 🔗 Share Trigger
           qualifies = calculatedStats.totalShares >= threshold;
        }
        else {
           // 📝 Default: Story Count Trigger (Liftoff, Road Warrior, etc.)
           qualifies = calculatedStats.stories >= threshold;
        }

        if (qualifies && !alreadyUnlocked) {
          console.log(`Unlocking Dynamic Badge: ${rule.name}`);
          hasUpdates = true;
          // XP Reward is purely visual/bonus here, assuming main XP comes from actions
          // But we can award bonus XP for the badge itself:
          newXP += 50; 
          
          currentBadges.push({
            id: rule.id,
            name: rule.name,
            icon: rule.icon,
            description: rule.description,
            color: rule.color,
            isUnlocked: true,
            unlockedAt: new Date().toISOString()
          });
        }
      });

      // 5. 📈 DYNAMIC RANK LOGIC
      //    Find the highest rank where currentXP >= rank.threshold
      //    (Ranks were already sorted by fetchGameRules)
      let eligibleRank = ranks.length > 0 ? ranks[0] : { name: "Tourist", minXP: 0 };
      
      // Iterate backwards to find highest eligible rank
      for (let i = ranks.length - 1; i >= 0; i--) {
          const r = ranks[i];
          const threshold = parseInt(r.threshold || r.minXP || 0);
          if (newXP >= threshold) {
              eligibleRank = r;
              break;
          }
      }
      
      // 6. COMMIT UPDATES
      transaction.update(userRef, {
        xp: newXP,
        badges: currentBadges,
        currentRank: eligibleRank,
        stats: {
            stories: calculatedStats.stories,
            likes: calculatedStats.totalLikes,
            shares: calculatedStats.totalShares,
            places: uniquePlacesCount
        }
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Sync Error:", error);
    return { success: false, error };
  }
};