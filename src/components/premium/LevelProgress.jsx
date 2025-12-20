// LevelProgress.jsx
import React from "react";
import { calculateLevel } from "../../services/profileService";

export default function LevelProgress({ points = 0 }) {
  const level = calculateLevel(points);

  // compute progress percentage for current level
  const levelMin = level === 1 ? 0 : level === 2 ? 100 : level === 3 ? 250 : level === 4 ? 500 : 1000;
  const levelMax = level === 1 ? 100 : level === 2 ? 250 : level === 3 ? 500 : level === 4 ? 1000 : 2000;
  const pct = Math.round(((points - levelMin) / (levelMax - levelMin)) * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1 text-sm text-gray-300">
        <span>Level {level}</span>
        <span>{points} pts</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
