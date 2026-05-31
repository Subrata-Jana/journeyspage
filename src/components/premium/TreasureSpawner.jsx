import React, { useEffect, useState } from "react";
import { Gem } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { collectLoot, requestTreasureOffer } from "../../services/gamificationService";

export default function TreasureSpawner({ storyId }) {
  const { user } = useAuth();
  const [spawnedItem, setSpawnedItem] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user || !storyId) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      const result = await requestTreasureOffer(storyId);
      if (active && result.success && result.offered && result.item) {
        setSpawnedItem(result.item);
        setIsVisible(true);
      }
    }, 5000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [storyId, user]);

  const handleCollect = async () => {
    if (!spawnedItem) return;
    setIsVisible(false);
    const result = await collectLoot(storyId);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    confetti({ particleCount: 120, spread: 76, origin: { y: 0.65 } });
    toast.success(`${spawnedItem.name} collected. +${result.xpGained || 0} XP`);
  };

  return (
    <AnimatePresence>
      {isVisible && spawnedItem && (
        <motion.button
          initial={{ scale: 0, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.08 }}
          onClick={handleCollect}
          className="fixed bottom-8 right-8 z-[90] group cursor-pointer"
          title="Claim treasure"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500/40 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-orange-500 to-yellow-600 p-4 rounded-2xl shadow-xl border-2 border-yellow-300">
              <Gem size={32} className="text-white drop-shadow-md animate-bounce" />
            </div>
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-xs font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
              Claim treasure
            </div>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
