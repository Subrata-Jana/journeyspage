// LevelBadge.jsx
import React from "react";

export default function LevelBadge({ level = 1, size = 48 }) {
  const colors = [
    "bg-gray-200 text-gray-800",
    "bg-orange-500 text-white",
    "bg-amber-600 text-white",
    "bg-indigo-600 text-white",
    "bg-rose-600 text-white"
  ];
  const idx = Math.max(0, Math.min(colors.length - 1, level - 1));

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${colors[idx]} shadow-md`}
      style={{ width: size, height: size }}
      aria-label={`Level ${level}`}
    >
      <div className="text-sm font-bold">Lv {level}</div>
    </div>
  );
}
