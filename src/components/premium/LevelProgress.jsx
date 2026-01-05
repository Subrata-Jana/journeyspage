import React from "react";
import { motion } from "framer-motion";

export default function LevelProgress({ currentXP, rankData }) {
  if (!rankData) return null;

  const { name, color, nextRank, progress, xpToNext } = rankData;
  
  const getBarColor = (c) => {
      const map = { 
          yellow: '#eab308', green: '#22c55e', lime: '#84cc16', blue: '#3b82f6', 
          purple: '#a855f7', orange: '#f97316', red: '#ef4444', sky: '#0ea5e9',
          indigo: '#6366f1', amber: '#f59e0b', slate: '#64748b' 
      };
      return map[c?.toLowerCase()] || '#64748b';
  };

  return (
    <div className="w-full mt-4">
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Rank</span>
            <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                {name} <span className="text-xs font-medium text-slate-400">({currentXP} XP)</span>
            </span>
        </div>
        {nextRank ? (
            <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next: {nextRank.name}</span>
                <div className="text-xs font-medium text-orange-500">+{xpToNext} XP needed</div>
            </div>
        ) : (
            <div className="text-xs font-bold text-yellow-500">MAX LEVEL</div>
        )}
      </div>

      <div className="h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative shadow-inner">
        <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${progress}%` }} 
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full relative rounded-full"
            style={{ backgroundColor: getBarColor(color) }}
        >
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"/>
        </motion.div>
      </div>
    </div>
  );
}