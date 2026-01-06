import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

// --- DEFAULT FALLBACKS (In case DB is empty) ---
const DEFAULT_RANKS = [
  { name: "Tourist", minXP: 0, icon: "MapPin" },
  { name: "Backpacker", minXP: 100, icon: "Compass" }
];

const DEFAULT_BADGES = [];

// --- 1. FETCH RULES FROM DB ---
export const fetchGameRules = async () => {
  try {
    const [ranksSnap, badgesSnap] = await Promise.all([
      getDoc(doc(db, "meta", "ranks")),
      getDoc(doc(db, "meta", "badges"))
    ]);

    const ranks = ranksSnap.exists() ? ranksSnap.data().items : DEFAULT_RANKS;
    const badges = badgesSnap.exists() ? badgesSnap.data().items : DEFAULT_BADGES;

    // Sort ranks by XP to ensure correct calculation order
    const sortedRanks = ranks.sort((a, b) => parseInt(a.threshold || a.minXP) - parseInt(b.threshold || b.minXP));

    return { ranks: sortedRanks, badges };
  } catch (error) {
    console.error("Error fetching game rules:", error);
    return { ranks: DEFAULT_RANKS, badges: DEFAULT_BADGES };
  }
};

// --- 2. DYNAMIC BADGE EVALUATOR ---
// This function takes the DB badge rules and checks them against user stats
export const evaluateBadges = (badgeRules, userStats) => {
  // badgeRules: The array of badge objects from Firestore (e.g. { name: "Liftoff", value: 1, icon: "Rocket" })
  // userStats: { stories: 5, likes: 100, places: 3, shares: 2 }

  const calculatedBadges = [];

  badgeRules.forEach(rule => {
    // We infer the "trigger" type based on the badge description or a specific field if you added one.
    // Since your Admin Panel adds generic items, let's map keywords in the 'description' or 'name' 
    // to specific stat checks.
    
    // You should ideally add a 'trigger' dropdown in your Admin Panel -> MetaEditor.
    // For now, we will try to auto-detect based on common patterns or assume "Story Count" if not specified.
    
    // *Admin Panel Mapping Logic:*
    // If you add a 'type' or 'trigger' field in Admin, use that. 
    // Below assumes standard triggers:
    
    let isEligible = false;
    const threshold = parseInt(rule.value || rule.threshold || 0);

    // LOGIC: Check Description Keywords (or add a 'trigger' field in Admin Panel for precision)
    const desc = (rule.description || "").toLowerCase();
    const name = (rule.name || "").toLowerCase();

    if (desc.includes("like") || name.includes("trendsetter") || name.includes("influencer")) {
       // ❤️ Likes Trigger
       isEligible = userStats.likes >= threshold;
    } 
    else if (desc.includes("visit") || desc.includes("place") || name.includes("walker")) {
       // 🌍 Places Trigger
       isEligible = userStats.places >= threshold;
    }
    else if (desc.includes("share")) {
       // 🔗 Share Trigger
       isEligible = userStats.shares >= threshold;
    }
    else {
       // 📝 Default: Story Count Trigger (Liftoff, Road Warrior, etc.)
       isEligible = userStats.stories >= threshold;
    }

    if (isEligible) {
      calculatedBadges.push({
        id: rule.id,
        name: rule.name,
        icon: rule.icon,
        description: rule.description,
        xpReward: parseInt(rule.xp || 50), // Default 50 if not set in Admin
        isUnlocked: true 
        // We add 'unlockedAt' in the service layer when saving
      });
    }
  });

  return calculatedBadges;
};

// --- 3. DYNAMIC RANK CALCULATOR ---
export const calculateRank = (ranks, currentXP) => {
  // Find the highest rank where minXP <= currentXP
  // ranks is assumed to be sorted ascending
  let eligibleRank = ranks[0];

  for (let i = ranks.length - 1; i >= 0; i--) {
    if (currentXP >= parseInt(ranks[i].threshold || ranks[i].minXP)) {
      eligibleRank = ranks[i];
      break;
    }
  }
  return eligibleRank;
};