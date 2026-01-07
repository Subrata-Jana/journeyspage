import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

// --- DEFAULT FALLBACKS ---
const DEFAULT_RANKS = [
  { name: "Tourist", minXP: 0, icon: "MapPin" },
  { name: "Backpacker", minXP: 100, icon: "Compass" }
];

const DEFAULT_BADGES = [];
const DEFAULT_LOOT = [];

// --- 1. FETCH ALL RULES (Ranks, Badges, Loot) ---
export const fetchGameRules = async () => {
  try {
    const [ranksSnap, badgesSnap, lootSnap] = await Promise.all([
      getDoc(doc(db, "meta", "ranks")),
      getDoc(doc(db, "meta", "badges")),
      getDoc(doc(db, "meta", "loot"))
    ]);

    const ranks = ranksSnap.exists() 
      ? (ranksSnap.data().items || []).sort((a, b) => parseInt(a.threshold) - parseInt(b.threshold)) 
      : DEFAULT_RANKS;

    const badges = badgesSnap.exists() ? (badgesSnap.data().items || []) : DEFAULT_BADGES;
    const loot = lootSnap.exists() ? (lootSnap.data().items || []) : DEFAULT_LOOT;

    return { ranks, badges, loot };
  } catch (error) {
    console.error("Error fetching game rules:", error);
    return { ranks: DEFAULT_RANKS, badges: DEFAULT_BADGES, loot: DEFAULT_LOOT };
  }
};

// --- 2. DYNAMIC BADGE EVALUATOR ---
export const evaluateBadges = (badgeRules, userStats) => {
  const calculatedBadges = [];

  badgeRules.forEach(rule => {
    let isEligible = false;
    const threshold = parseInt(rule.value || rule.threshold || 0);
    const desc = (rule.description || "").toLowerCase();
    const name = (rule.name || "").toLowerCase();

    if (desc.includes("like") || name.includes("trendsetter") || name.includes("influencer")) {
       isEligible = userStats.likes >= threshold;
    } 
    else if (desc.includes("visit") || desc.includes("place") || name.includes("walker")) {
       isEligible = userStats.places >= threshold;
    }
    else if (desc.includes("share")) {
       isEligible = userStats.shares >= threshold;
    }
    else {
       isEligible = userStats.stories >= threshold;
    }

    if (isEligible) {
      calculatedBadges.push({
        id: rule.id,
        name: rule.name,
        icon: rule.icon,
        description: rule.description,
        xpReward: parseInt(rule.xp || 50),
        isUnlocked: true 
      });
    }
  });

  return calculatedBadges;
};

// --- 3. DYNAMIC RANK CALCULATOR ---
export const calculateRank = (ranks, currentXP) => {
  let eligibleRank = ranks[0];
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (currentXP >= parseInt(ranks[i].threshold || ranks[i].minXP)) {
      eligibleRank = ranks[i];
      break;
    }
  }
  return eligibleRank;
};

// --- 4. 🧹 WALLET CLEANER (Removes Expired Items) ---
export const getCleanWallet = (userInventory = []) => {
    const now = new Date();
    let hasChanges = false;

    const cleanInventory = userInventory.filter(item => {
        // If it's a legacy string ID (from old system), keep it (Permanent)
        if (typeof item === 'string') return true;

        // If it's an object with expiresAt, check date
        if (item.expiresAt) {
            const expiryDate = new Date(item.expiresAt);
            if (expiryDate < now) {
                hasChanges = true; 
                return false; // Remove! Rotted!
            }
        }
        return true; // Keep valid items
    });

    return { cleanInventory, hasChanges };
};

// --- 5. 🎁 DAILY REWARD SELECTOR ---
export const selectDailyReward = (lootRules) => {
    // Find "Common" items to give as daily login bonus
    // Fallback to "Paper Plane" logic if no rules exist
    const commonItems = lootRules.filter(i => i.rarity === 'Common' || !i.rarity);
    
    if (commonItems.length === 0) return null;
    
    const randomItem = commonItems[Math.floor(Math.random() * commonItems.length)];
    
    // Default Expiry: Common = 24h, Uncommon = 72h (if not set in Admin)
    let hours = 24;
    if (randomItem.expiryHours) hours = parseInt(randomItem.expiryHours);
    else if (randomItem.rarity === 'Uncommon') hours = 72;
    
    return { ...randomItem, expiryHours: hours };
};