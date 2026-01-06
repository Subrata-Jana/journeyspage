import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import * as LucideIcons from "lucide-react"; 

// --- DYNAMIC GAMIFICATION HOOK ---
export function useGamification(userXP = 0, userBadges = [], userInventory = []) {
  const [ranks, setRanks] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [allLoot, setAllLoot] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch configurations set in Admin Panel
        const [ranksSnap, badgesSnap, lootSnap] = await Promise.all([
          getDoc(doc(db, "meta", "ranks")),
          getDoc(doc(db, "meta", "badges")),
          getDoc(doc(db, "meta", "loot"))
        ]);

        if (ranksSnap.exists()) {
            // Sort ranks by threshold (0 -> 100 -> 500...)
            // Added parseInt to ensure string values from Admin Panel don't break sorting
            setRanks(ranksSnap.data().items.sort((a, b) => parseInt(a.threshold) - parseInt(b.threshold)));
        }
        if (badgesSnap.exists()) setAllBadges(badgesSnap.data().items || []);
        if (lootSnap.exists()) setAllLoot(lootSnap.data().items || []);
        
      } catch (error) {
        console.error("Gamification load error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- CALCULATE CURRENT RANK ---
  const getCurrentRank = () => {
    if (ranks.length === 0) return null;
    
    // Find the highest rank where threshold <= userXP
    const index = ranks.findLastIndex(r => parseInt(r.threshold || 0) <= userXP);
    const current = ranks[index] || ranks[0];
    const next = ranks[index + 1] || null;

    let progress = 100;
    let xpToNext = 0;

    if (next) {
      const currentThreshold = parseInt(current.threshold || 0);
      const nextThreshold = parseInt(next.threshold || 0);
      
      const range = nextThreshold - currentThreshold;
      const gained = userXP - currentThreshold;
      
      progress = Math.min(100, Math.max(0, (gained / range) * 100));
      xpToNext = nextThreshold - userXP;
    }

    return { ...current, nextRank: next, progress, xpToNext };
  };

  // --- PROCESS COLLECTIONS ---
  const getProcessedBadges = () => {
    return allBadges.map(badge => ({
      ...badge,
      // 🛠️ FIX: Check if userBadges (array of objects) contains this badge ID
      // .includes() fails on objects, so we use .some() to check IDs match
      isUnlocked: userBadges.some(ub => ub.id === badge.id)
    }));
  };

  const getProcessedLoot = () => {
    return allLoot.map(item => ({
      ...item,
      // Loot is stored as simple ID strings, so .includes() is correct here
      isUnlocked: userInventory.includes(item.id)
    }));
  };

  return {
    loading,
    currentRank: getCurrentRank(),
    badges: getProcessedBadges(),
    loot: getProcessedLoot(),
  };
}

// --- HELPER: Render Dynamic Icons ---
export const RenderIcon = ({ iconName, size = 20, className }) => {
    const Icon = LucideIcons[iconName] || LucideIcons.Star;
    return <Icon size={size} className={className} />;
};