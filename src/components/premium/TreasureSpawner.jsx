import React, { useState, useEffect } from "react";
import { Gem } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { collectLoot } from "../../services/gamificationService"; // Import the file above
import { useGamification } from "../../hooks/useGamification";   // Import your hook
import toast from "react-hot-toast";
import confetti from "canvas-confetti"; 

export default function TreasureSpawner() {
  const { user } = useAuth();
  // This hook fetches the loot list with the POINTS you set in Admin Panel
  const { loot } = useGamification(); 
  const [spawnedItem, setSpawnedItem] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user || loot.length === 0) return;

    // 🎲 15% Chance to spawn treasure when reading a story
    const chance = Math.random();
    if (chance < 0.15) { 
      // Filter to find items the user DOESN'T have yet
      const uncollected = loot.filter(item => !item.isUnlocked);
      
      // If they have everything, stop spawning (or spawn generic coins in future)
      if (uncollected.length === 0) return;

      // Pick a random uncollected item
      const randomItem = uncollected[Math.floor(Math.random() * uncollected.length)];
      
      // Delay appearance by 5 seconds so they start reading first
      const delay = 5000; 
      setTimeout(() => {
        setSpawnedItem(randomItem);
        setIsVisible(true);
      }, delay); 
    }
  }, [user, loot]);

  const handleCollect = async () => {
    if (!spawnedItem) return;
    
    setIsVisible(false); // Hide the chest
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } }); // 🎉 Celebration

    // Pass the item (containing YOUR points) to the service
    const result = await collectLoot(user.uid, spawnedItem);
    
    if (result.success) {
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-[#1A1F2E] border border-yellow-500/50 p-4 rounded-xl shadow-2xl flex items-center gap-4`}>
          <div className="text-4xl">🎁</div>
          <div>
            <h4 className="text-yellow-500 font-bold">Treasure Found!</h4>
            <div className="text-white text-sm">
                You collected: <span className="font-bold text-yellow-200">{spawnedItem.name}</span>
            </div>
            {/* Display the Points you set in Admin Panel */}
            <div className="text-xs text-green-400 font-bold mt-1">
                +{result.xpGained} Rank XP
            </div>
          </div>
        </div>
      ));
    } else {
        toast.error(result.message);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && spawnedItem && (
        <motion.button
          initial={{ scale: 0, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          onClick={handleCollect}
          className="fixed bottom-8 right-8 z-[90] group cursor-pointer"
        >
          <div className="relative">
            {/* Glowing effect */}
            <div className="absolute inset-0 bg-yellow-500/40 rounded-full blur-xl animate-pulse"></div>
            
            {/* The Chest Icon */}
            <div className="relative bg-gradient-to-br from-orange-500 to-yellow-600 p-4 rounded-2xl shadow-xl border-2 border-yellow-300">
                <Gem size={32} className="text-white drop-shadow-md animate-bounce" />
            </div>

            {/* Tooltip */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-xs font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                Click to Claim!
            </div>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}