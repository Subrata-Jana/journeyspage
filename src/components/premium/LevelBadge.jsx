import React from "react";
import { RenderIcon } from "../../hooks/useGamification";

const COLOR_MAP = {
  slate: "bg-slate-100 text-slate-600 border-slate-300",
  blue: "bg-blue-100 text-blue-600 border-blue-300",
  sky: "bg-sky-100 text-sky-600 border-sky-300",
  green: "bg-green-100 text-green-600 border-green-300",
  emerald: "bg-emerald-100 text-emerald-600 border-emerald-300",
  lime: "bg-lime-100 text-lime-600 border-lime-300",
  orange: "bg-orange-100 text-orange-600 border-orange-300",
  red: "bg-red-100 text-red-600 border-red-300",
  purple: "bg-purple-100 text-purple-600 border-purple-300",
  yellow: "bg-yellow-100 text-yellow-600 border-yellow-300",
  amber: "bg-amber-100 text-amber-600 border-amber-300",
  indigo: "bg-indigo-100 text-indigo-600 border-indigo-300",
};

export default function LevelBadge({ rank, size = "md" }) {
  if (!rank) return null;

  const colorClass = COLOR_MAP[rank.color?.toLowerCase()] || COLOR_MAP.slate;
  const sizeClass = size === "lg" ? "w-16 h-16" : "w-10 h-10";
  const iconSize = size === "lg" ? 28 : 18;

  return (
    <div className={`relative flex items-center justify-center rounded-full border-4 border-white dark:border-[#151b2b] shadow-xl ${colorClass} ${sizeClass}`} title={rank.name}>
      <RenderIcon iconName={rank.icon} size={iconSize} />
    </div>
  );
}