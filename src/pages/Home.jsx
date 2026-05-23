import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Compass,
  Flame,
  Globe2,
  MapPin,
  Mountain,
  Palmtree,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Tent,
  TrendingUp,
} from "lucide-react";

import SmartImage from "../components/ui/SmartImage";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { getProfilePhotoUrl } from "../utils/userProfile";

const getTimestampValue = (timestamp) => {
  if (!timestamp) return 0;
  if (typeof timestamp === "number") return timestamp;
  if (timestamp?.seconds) return timestamp.seconds * 1000;
  return 0;
};

const getStoryScore = (story) => {
  const likes =
    typeof story.likeCount === "number"
      ? story.likeCount
      : Array.isArray(story.likes)
        ? story.likes.length
        : 0;
  const shares =
    typeof story.shareCount === "number"
      ? story.shareCount
      : Array.isArray(story.sharedBy)
        ? story.sharedBy.length
        : 0;
  const gifts = Number(story.giftCount || story.tributeCount || 0);
  const views = Number(story.views || 0);

  return likes * 6 + shares * 16 + gifts * 10 + views;
};

const getStoryLikeCount = (story) =>
  typeof story.likeCount === "number"
    ? story.likeCount
    : Array.isArray(story.likes)
      ? story.likes.length
      : 0;

const getStoryShareCount = (story) =>
  typeof story.shareCount === "number"
    ? story.shareCount
    : Array.isArray(story.sharedBy)
      ? story.sharedBy.length
      : 0;

const getStoryGiftCount = (story) => Number(story.giftCount || story.tributeCount || 0);

const getStoryViewCount = (story) => Number(story.views || 0);

const getStoryLocationMeta = (story) =>
  story?.locationData?.value || story?.locationData || {};

const getStoryLocationLabel = (story) => {
  const meta = getStoryLocationMeta(story);
  return (
    story.location ||
    meta.placeName ||
    meta.locality ||
    meta.displayLabel ||
    "Unknown destination"
  );
};

const getStoryCountry = (story) => {
  const meta = getStoryLocationMeta(story);
  return story.country || meta.country || "";
};

const getStoryExcerpt = (story) =>
  story.aboutPlace ||
  story.specialNote ||
  "Traveler-tested route with practical details, visuals, and story-led planning.";

const formatStoryDate = (story) => {
  const timestamp = getTimestampValue(
    story.updatedAt || story.createdAt || story.publishedAt
  );
  if (!timestamp) return "Freshly shared";

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const formatBudget = (value) => {
  const numeric = Number(value || 0);
  if (!numeric) return "Flexible";
  return `Rs${numeric.toLocaleString()}`;
};

const getCategoryIcon = (label = "") => {
  const value = label.toLowerCase();
  if (value.includes("beach") || value.includes("coast")) return Palmtree;
  if (value.includes("camp")) return Tent;
  if (value.includes("photo") || value.includes("visual")) return Camera;
  if (value.includes("trek") || value.includes("mount") || value.includes("hill")) {
    return Mountain;
  }
  return Compass;
};

const getStoryLinkState = (pathname, search) => ({
  from: `${pathname}${search}`,
});

const getStoryAuthorImage = (story) =>
  getProfilePhotoUrl({
    photoURL: story.authorPhoto,
    avatarUrl: story.authorPhoto,
    profilePhoto: story.authorPhoto,
  }) ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    story.authorName || "Explorer"
  )}&background=0f172a&color=ffffff`;

const getStoryVisuals = (story) => {
  const galleryItems = Array.isArray(story.gallery) ? story.gallery : [];
  const visuals = [];

  if (story.coverImage) {
    visuals.push({
      url: story.coverImage,
      caption: story.coverImageCaption || "",
      is360: false,
      source: "cover",
    });
  }

  galleryItems.forEach((item) => {
    if (typeof item === "string" && item) {
      visuals.push({
        url: item,
        caption: "",
        is360: false,
        source: "gallery",
      });
      return;
    }

    if (item?.url) {
      visuals.push({
        url: item.url,
        caption: item.caption || "",
        is360: !!item.is360,
        source: item.is360 ? "panorama" : "gallery",
      });
    }
  });

  const seen = new Set();
  return visuals.filter((visual) => {
    if (!visual.url || seen.has(visual.url)) return false;
    seen.add(visual.url);
    return true;
  });
};

const getHeroStoryFacts = (story) => {
  const facts = [
    story.authorName ? { label: "Author", value: story.authorName } : null,
    story.tripType ? { label: "Trip Type", value: story.tripType } : null,
    story.difficulty ? { label: "Difficulty", value: story.difficulty } : null,
    story.category ? { label: "Category", value: story.category } : null,
    story.totalCost || story.budget || story.estimatedBudget
      ? {
          label: "Budget",
          value: formatBudget(story.totalCost || story.budget || story.estimatedBudget),
        }
      : null,
    getStoryCountry(story) ? { label: "Country", value: getStoryCountry(story) } : null,
    { label: "Published", value: formatStoryDate(story) },
  ];

  return facts.filter(Boolean).slice(0, 6);
};

const getHeroStoryHighlight = (story) => {
  if (story.coverImageCaption?.trim()) {
    return {
      label: "Cover caption",
      text: story.coverImageCaption.trim(),
    };
  }

  if (story.specialNote?.trim()) {
    return {
      label: "Special note",
      text: story.specialNote.trim(),
    };
  }

  if (story.aboutPlace?.trim()) {
    return {
      label: "About this place",
      text: story.aboutPlace.trim(),
    };
  }

  return null;
};

const pickRandomStoryId = (stories, excludeStoryId = null) => {
  if (!stories.length) return null;
  if (stories.length === 1) return stories[0].id;

  const pool = excludeStoryId
    ? stories.filter((story) => story.id !== excludeStoryId)
    : stories;
  const candidates = pool.length ? pool : stories;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
};

function HomeSkeleton() {
  return (
    <div className="-mt-[68px] bg-slate-50 dark:bg-[#0B0F19]">
      <div className="relative min-h-screen overflow-hidden bg-[#09111f]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-900 via-[#0d1728] to-slate-950" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-36 pb-24 grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
          <div className="space-y-6">
            <div className="h-8 w-40 rounded-full bg-white/10 animate-pulse" />
            <div className="h-16 w-4/5 rounded-3xl bg-white/10 animate-pulse" />
            <div className="h-6 w-2/3 rounded-2xl bg-white/10 animate-pulse" />
            <div className="flex gap-4">
              <div className="h-12 w-44 rounded-full bg-white/10 animate-pulse" />
              <div className="h-12 w-40 rounded-full bg-white/10 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 rounded-3xl bg-white/10 border border-white/10 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 animate-pulse"
            />
          ))}
        </div>
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <div className="aspect-[1.25/1] rounded-[2rem] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 animate-pulse" />
          <div className="grid gap-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-36 rounded-[1.75rem] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, compact = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 font-black text-slate-900 dark:text-white ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.28em] font-bold text-orange-500 mb-3">
            {eyebrow}
          </div>
        )}
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
          {title}
        </h2>
        {description && (
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="self-start px-5 py-3 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white font-bold text-sm hover:border-orange-500/30 hover:text-orange-500 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function DiscoveryPills({ categories, activeCategory, onSelect }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {categories.map((category) => {
        const Icon = getCategoryIcon(category);
        const active = activeCategory === category;
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={`flex items-center gap-2 px-5 py-3 rounded-full border transition-all whitespace-nowrap text-sm font-bold ${
              active
                ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-lg"
                : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-orange-500/30 hover:text-orange-500"
            }`}
          >
            <Icon size={16} />
            {category}
          </button>
        );
      })}
    </div>
  );
}

function HomeFallback({ onWrite, isLoggedIn, hasError = false }) {
  const title = hasError
    ? "Approved journeys exist, but the homepage could not load them right now."
    : "JourneysPage is ready for its first featured adventure.";
  const description = hasError
    ? "The public story feed is temporarily unavailable. You can still create, review, and manage stories while we reconnect this surface."
    : "Publish the first approved story to turn this homepage into a proper travel discovery surface.";
  const actionLabel = isLoggedIn ? "Create The First Story" : "Join And Start Writing";

  return (
    <div className="-mt-[68px] bg-slate-50 dark:bg-[#0B0F19]">
      <section className="relative overflow-hidden min-h-[78vh]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.26),transparent_34%),linear-gradient(135deg,#07111d_0%,#0B0F19_52%,#101827_100%)]" />
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/15 border border-orange-400/25 backdrop-blur-md text-orange-200 text-xs font-bold uppercase tracking-[0.25em]">
                <Sparkles size={14} className="text-orange-300" />
                {hasError ? "Connection Needed" : "Homepage Standby"}
              </div>

              <div className="space-y-4 max-w-4xl">
                <h1 className="text-4xl md:text-6xl lg:text-[5rem] font-black text-white leading-[0.96] tracking-tight">
                  {title}
                </h1>
                <p className="max-w-2xl text-base md:text-lg text-slate-200/85 leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={onWrite}
                  className="px-6 py-3.5 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-bold transition-colors shadow-xl"
                >
                  {actionLabel}
                </button>
                <span className="text-sm text-slate-300/80">
                  {hasError
                    ? "Check Firestore read access for approved stories."
                    : "Once an approved story exists, this section will feature it automatically."}
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 max-w-3xl">
                {[
                  {
                    icon: ShieldCheck,
                    label: "Reviewed publishing",
                    text: "Stories are meant to appear here after admin approval.",
                  },
                  {
                    icon: Globe2,
                    label: "Public discovery",
                    text: "Visitors should be able to browse approved journeys without logging in.",
                  },
                  {
                    icon: ScrollText,
                    label: "Story-first layout",
                    text: "The hero automatically upgrades from fallback mode to a real approved post.",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-4"
                  >
                    <item.icon size={18} className="text-orange-300 mb-3" />
                    <div className="text-white font-bold text-sm">{item.label}</div>
                    <div className="text-slate-300/80 text-xs leading-relaxed mt-1">
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/25 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="text-[10px] uppercase tracking-[0.25em] text-orange-300 font-bold mb-2">
                  {hasError ? "Why nothing is showing" : "What happens next"}
                </div>
                <div className="text-2xl md:text-3xl font-black text-white leading-tight">
                  {hasError ? "Public read rules and homepage query must agree." : "Approved posts will populate the hero automatically."}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-400">
                    Homepage source
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    Approved story documents
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <MetricPill label="Visibility" value="Public" />
                  <MetricPill label="Workflow" value="Reviewed" />
                  <MetricPill label="Hero Mode" value={hasError ? "Blocked" : "Standby"} />
                  <MetricPill label="Footer" value="Enabled" />
                </div>

                <p className="text-sm md:text-base text-slate-300/85 leading-relaxed">
                  {hasError
                    ? "Your admin-approved posts likely exist, but the homepage was querying with a field combination that public Firestore rules do not allow."
                    : "This fallback is now more intentional, but it is only meant as a backup until the first approved story goes live."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroSection({ story, onExplore, onWrite, onOpenStory, onShuffle }) {
  if (!story) return null;

  const storyFacts = getHeroStoryFacts(story).slice(0, 4);
  const storyHighlight = getHeroStoryHighlight(story);
  const storyVisuals = getStoryVisuals(story);
  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <SmartImage
          src={story.coverImage}
          alt={story.title}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover"
          variant="hero"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.14),transparent_32%)]" />
        <div className="absolute inset-0 bg-black/28" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07111d]/22 via-transparent to-[#0B0F19]/62" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07111d]/34 via-[#07111d]/10 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20 lg:pb-28 min-h-screen flex items-end">
        <AnimatePresence mode="wait">
          <motion.div
            key={story.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45 }}
            className="w-full space-y-8"
          >
            <div className="space-y-6 max-w-4xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/15 border border-orange-400/25 backdrop-blur-md text-orange-200 text-xs font-bold uppercase tracking-[0.25em]">
                <Sparkles size={14} className="text-orange-300" />
                Featured Approved Journey
              </div>

              <div className="space-y-5">
                <h1 className="text-4xl md:text-6xl lg:text-[5.5rem] font-black text-white leading-[0.93] tracking-tight max-w-5xl [text-shadow:_0_6px_28px_rgb(0_0_0_/_45%),_0_2px_10px_rgb(0_0_0_/_50%)]">
                  {story.title}
                </h1>
                <p className="max-w-2xl text-base md:text-lg text-slate-100/92 leading-relaxed [text-shadow:_0_4px_18px_rgb(0_0_0_/_40%),_0_1px_3px_rgb(0_0_0_/_55%)]">
                  {getStoryExcerpt(story)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-100/90">
                <span className="flex items-center gap-2">
                  <MapPin size={16} className="text-orange-300" />
                  {getStoryLocationLabel(story)}
                </span>
                {getStoryCountry(story) && (
                  <span className="flex items-center gap-2">
                    <Globe2 size={16} className="text-sky-300" />
                    {getStoryCountry(story)}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-emerald-300" />
                  {formatStoryDate(story)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onOpenStory(story.id)}
                  className="px-6 py-3.5 rounded-full bg-white text-slate-950 hover:bg-orange-500 hover:text-white font-bold text-sm md:text-base transition-all shadow-xl flex items-center gap-3 hover:scale-[1.02]"
                >
                  Read This Journey <ArrowRight size={18} />
                </button>
                <button
                  onClick={onShuffle}
                  className="px-6 py-3.5 rounded-full border border-white/15 bg-black/18 text-white hover:bg-white/10 backdrop-blur-md font-bold text-sm md:text-base transition-all flex items-center gap-3"
                >
                  Show Another <RefreshCw size={16} />
                </button>
                <button
                  onClick={onWrite}
                  className="px-2 py-2 text-sm md:text-base text-white/90 hover:text-orange-300 font-bold transition-colors"
                >
                  Share Your Story
                </button>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="w-fit max-w-full rounded-[1.5rem] border border-white/10 bg-black/18 backdrop-blur-xl shadow-2xl overflow-hidden"
            >
              <div className="px-4 md:px-5 pt-3.5 md:pt-4 flex items-center justify-between gap-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-orange-300 font-bold">
                  Journey Brief
                </div>
                <button
                  onClick={onExplore}
                  className="text-xs font-bold uppercase tracking-[0.18em] text-white/75 hover:text-orange-300 transition-colors"
                >
                  Browse All
                </button>
              </div>

              <div className="p-3.5 md:p-4 space-y-2.5">
                <div className="flex flex-wrap gap-2.5">
                  {storyFacts.map((fact) => (
                    <div
                      key={fact.label}
                      className={`px-3.5 py-3 rounded-[1.1rem] border border-white/10 bg-white/5 ${
                        fact.label === "Author"
                          ? "min-w-[16.5rem]"
                          : "min-w-[11rem] md:min-w-[12rem]"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-400">
                        {fact.label}
                      </div>
                      {fact.label === "Author" ? (
                        <div className="mt-2 flex items-center gap-3 min-w-0">
                          <img
                            src={getStoryAuthorImage(story)}
                            alt={story.authorName || "Author"}
                            className="h-10 w-10 rounded-full object-cover border border-white/15 bg-slate-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-black text-white truncate">
                              {fact.value}
                            </div>
                            <div className="mt-1 inline-flex items-center rounded-full bg-orange-500/15 border border-orange-400/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200">
                              {story.authorRank || "Scout"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5 text-sm font-black text-white line-clamp-1">
                          {fact.value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {storyHighlight && (
                  <div className="max-w-3xl rounded-[1.1rem] border border-white/10 bg-white/5 px-3.5 py-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-orange-200 mb-1.5">
                      {storyHighlight.label}
                    </div>
                    <p className="text-sm text-slate-200/90 leading-relaxed line-clamp-2">
                      {storyHighlight.text}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function ProofStrip({ stats }) {
  const cards = [
    {
      label: "Approved Stories",
      value: stats.totalStories,
      icon: ScrollText,
      accent: "text-orange-500",
    },
    {
      label: "Places Represented",
      value: stats.uniquePlaces,
      icon: MapPin,
      accent: "text-emerald-500",
    },
    {
      label: "Countries Mentioned",
      value: stats.countries,
      icon: Globe2,
      accent: "text-sky-500",
    },
    {
      label: "Fresh Journeys Loaded",
      value: stats.loadedStories,
      icon: TrendingUp,
      accent: "text-pink-500",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 -mt-10 relative z-20">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#111625]/85 backdrop-blur-xl p-5 shadow-sm"
          >
            <card.icon size={18} className={`${card.accent} mb-4`} />
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
              {card.value}
            </div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500 mt-1">
              {card.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpotlightCard({ story, onOpen, fromState }) {
  if (!story) return null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      className="group rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] shadow-sm"
    >
      <div className="relative aspect-[1.2/1] overflow-hidden">
        <SmartImage
          src={story.coverImage}
          alt={story.title}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/10 to-transparent" />
        <div className="absolute top-5 left-5 flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold uppercase tracking-wider">
            {story.tripType || "Journey"}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold uppercase tracking-wider">
            {story.difficulty || "Open level"}
          </span>
        </div>
      </div>

      <div className="p-6 md:p-7 space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-orange-500" />
              {getStoryLocationLabel(story)}
            </span>
            <span>{formatStoryDate(story)}</span>
          </div>

          <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
            {story.title}
          </h3>

          <p className="text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
            {getStoryExcerpt(story)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MetricPill label="Views" value={Number(story.views || 0)} />
          <MetricPill
            label="Likes"
            value={
              typeof story.likeCount === "number"
                ? story.likeCount
                : Array.isArray(story.likes)
                  ? story.likes.length
                  : 0
            }
          />
          <MetricPill label="Budget" value={formatBudget(story.totalCost)} compact />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10">
              {story.authorPhoto ? (
                <img
                  src={story.authorPhoto}
                  alt={story.authorName || "Author"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                  {(story.authorName || "JP").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-orange-500">
                {story.authorRank || "Scout"}
              </div>
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {story.authorName || "JourneysPage"}
              </div>
            </div>
          </div>
          <button
            onClick={() => onOpen(story.id, fromState)}
            className="px-5 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-sm hover:bg-orange-500 hover:text-white transition-colors flex items-center gap-2 shrink-0"
          >
            Open Story <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function CompactStoryCard({ story, onOpen, fromState, eyebrow = "Journey" }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      className="group rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] shadow-sm hover:shadow-xl transition-all"
    >
      <button className="w-full text-left" onClick={() => onOpen(story.id, fromState)}>
        <div className="relative aspect-[1.2/0.9] overflow-hidden">
          <SmartImage
            src={story.coverImage}
            alt={story.title}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101827] via-transparent to-black/10" />
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
            {eyebrow}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              <MapPin size={12} className="text-orange-500" />
              {getStoryLocationLabel(story)}
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight line-clamp-2 group-hover:text-orange-500 transition-colors">
              {story.title}
            </h3>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
            {getStoryExcerpt(story)}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] font-bold text-slate-400">
                {story.authorRank || "Scout"}
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {story.authorName || "Explorer"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.24em] font-bold text-slate-400">
                Score
              </div>
              <div className="font-black text-slate-900 dark:text-white">
                {getStoryScore(story)}
              </div>
            </div>
          </div>
        </div>
      </button>
    </motion.article>
  );
}

function WhyJourneysPage({ onCreate }) {
  const features = [
    {
      icon: ShieldCheck,
      title: "Moderated quality",
      text: "Stories pass through review before they go live, so the homepage feels curated rather than noisy.",
    },
    {
      icon: ScrollText,
      title: "Structured travel stories",
      text: "Trips carry places, practical details, and visual diary elements together instead of acting like plain blog posts.",
    },
    {
      icon: Globe2,
      title: "Better destination discovery",
      text: "Location-aware stories make it easier to browse by place, state, country, and type of journey.",
    },
    {
      icon: Sparkles,
      title: "Community progression",
      text: "Ranks, badges, gifts, and tracking turn good stories into an actual explorer community loop.",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-24">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
        <div className="space-y-6">
          <div className="text-[11px] uppercase tracking-[0.28em] font-bold text-orange-500">
            Why It Feels Different
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Built like a travel magazine, powered like a living community.
          </h2>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
            JourneysPage works best when a visitor can trust what they see, enjoy the
            visual storytelling, and quickly decide whether a route is worth opening.
            That balance is what turns a homepage into a product surface.
          </p>
          <button
            onClick={onCreate}
            className="px-6 py-3.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-sm hover:bg-orange-500 hover:text-white transition-colors flex items-center gap-2"
          >
            Start Your First Journey <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] p-6 shadow-sm"
            >
              <feature.icon size={20} className="text-orange-500 mb-4" />
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCallToAction({ onPrimary, onSecondary, isLoggedIn }) {
  return (
    <section className="max-w-7xl mx-auto px-6 pb-24">
      <div className="rounded-[2.5rem] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.30),transparent_35%),linear-gradient(135deg,#101827_0%,#0B0F19_55%,#151b2b_100%)] p-8 md:p-12 shadow-2xl">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] font-bold text-orange-300 mb-4">
              Ready To Join In
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight max-w-3xl">
              Read deeper, publish smarter, and make your travel story worth following.
            </h2>
            <p className="text-slate-300 mt-4 max-w-2xl leading-relaxed">
              Explore approved journeys, learn from how real travelers document their
              routes, and then create your own story with structure, visuals, and
              community feedback built in.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:min-w-[220px]">
            <button
              onClick={onPrimary}
              className="px-6 py-3.5 rounded-full bg-white text-slate-950 hover:bg-orange-500 hover:text-white font-bold text-sm transition-colors"
            >
              {isLoggedIn ? "Write A Journey" : "Join JourneysPage"}
            </button>
            <button
              onClick={onSecondary}
              className="px-6 py-3.5 rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10 font-bold text-sm transition-colors"
            >
              Browse Featured Stories
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const discoverRef = useRef(null);

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [heroStoryId, setHeroStoryId] = useState(null);
  const [totalStories, setTotalStories] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    let isMounted = true;

    const fetchStories = async () => {
      try {
        const storiesRef = collection(db, "stories");
        const approvedStoriesQuery = query(
          storiesRef,
          where("status", "==", "approved"),
          orderBy("createdAt", "desc"),
          limit(36)
        );

        const [storiesSnap, storyCountSnap] = await Promise.all([
          getDocs(approvedStoriesQuery),
          getCountFromServer(query(storiesRef, where("status", "==", "approved"))),
        ]);

        if (!isMounted) return;

        const approvedStories = storiesSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setStories(approvedStories);
        setTotalStories(storyCountSnap.data().count || approvedStories.length);
        setLoadError(null);
      } catch (error) {
        console.error("Error loading homepage stories:", error);
        if (isMounted) {
          setStories([]);
          setTotalStories(0);
          setLoadError(error);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStories();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setHeroStoryId((currentStoryId) => {
      if (currentStoryId && stories.some((story) => story.id === currentStoryId)) {
        return currentStoryId;
      }
      return pickRandomStoryId(stories);
    });
  }, [stories]);

  const heroStory = useMemo(
    () => stories.find((story) => story.id === heroStoryId) || stories[0] || null,
    [stories, heroStoryId]
  );

  const categories = useMemo(() => {
    const dynamic = Array.from(
      new Set(stories.map((story) => story.tripType).filter(Boolean))
    ).slice(0, 6);
    return ["All", ...dynamic];
  }, [stories]);

  const filteredStories = useMemo(() => {
    if (activeCategory === "All") return stories;
    return stories.filter((story) => story.tripType === activeCategory);
  }, [stories, activeCategory]);

  const spotlightStory = filteredStories[0] || stories[0] || null;
  const rankedStories = useMemo(
    () => [...filteredStories].sort((a, b) => getStoryScore(b) - getStoryScore(a)),
    [filteredStories]
  );

  const trendingStories = rankedStories.slice(1, 4);
  const freshStories = [...stories]
    .sort(
      (a, b) =>
        getTimestampValue(b.updatedAt || b.createdAt) -
        getTimestampValue(a.updatedAt || a.createdAt)
    )
    .slice(0, 3);

  const stats = useMemo(() => {
    const uniquePlaces = new Set();
    const countries = new Set();
    stories.forEach((story) => {
      const meta = getStoryLocationMeta(story);
      const placeKey =
        meta.place_id ||
        meta.displayLabel ||
        story.location ||
        `${story.state || ""}-${story.country || ""}`;
      const countryKey = story.country || meta.country;
      if (placeKey) uniquePlaces.add(String(placeKey).toLowerCase());
      if (countryKey) countries.add(String(countryKey).toLowerCase());
    });
    return {
      totalStories,
      uniquePlaces: uniquePlaces.size,
      countries: countries.size,
      loadedStories: stories.length,
    };
  }, [stories, totalStories]);

  const openStory = (storyId, state = null) => {
    navigate(`/story/${storyId}`, { state });
  };

  const handleExplore = () => {
    discoverRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleWrite = () => {
    navigate(user ? "/create-story" : "/register");
  };

  const handleShuffleHero = () => {
    setHeroStoryId((currentStoryId) => pickRandomStoryId(stories, currentStoryId));
  };

  if (loading) return <HomeSkeleton />;

  if (loadError) {
    return <HomeFallback onWrite={handleWrite} isLoggedIn={!!user} hasError />;
  }

  if (!stories.length) {
    return <HomeFallback onWrite={handleWrite} isLoggedIn={!!user} />;
  }

  return (
    <div className="-mt-[68px] bg-slate-50 dark:bg-[#0B0F19]">
      <HeroSection
        story={heroStory}
        onExplore={handleExplore}
        onWrite={handleWrite}
        onOpenStory={(storyId) =>
          openStory(storyId, getStoryLinkState(location.pathname, location.search))
        }
        onShuffle={handleShuffleHero}
      />

      <ProofStrip stats={stats} />

      <section ref={discoverRef} className="max-w-7xl mx-auto px-6 pt-20 pb-8">
        <SectionHeader
          eyebrow="Discover"
          title="Editorial picks from the latest approved journeys."
          description="Designed to feel like a premium travel front page: one strong lead story, followed by high-signal journeys worth opening next."
          actionLabel={user ? "Open Travel Hub" : "Start Writing"}
          onAction={() => navigate(user ? "/dashboard?view=feed" : "/register")}
        />

        <DiscoveryPills
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8">
          <SpotlightCard
            story={spotlightStory}
            onOpen={openStory}
            fromState={getStoryLinkState(location.pathname, location.search)}
          />
          <div className="grid gap-5">
            {trendingStories.map((story) => (
              <CompactStoryCard
                key={story.id}
                story={story}
                eyebrow="Trending"
                onOpen={openStory}
                fromState={getStoryLinkState(location.pathname, location.search)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-6">
        <SectionHeader
          eyebrow="Momentum"
          title="Fresh approvals and community heat."
          description="A balanced mix of fast-rising journeys and newly approved stories so visitors always have a reason to keep exploring."
        />

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Flame size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.26em] font-bold text-orange-500">
                  Trending Now
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Stories pulling attention
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {rankedStories.slice(0, 4).map((story, index) => (
                <button
                  key={story.id}
                  onClick={() =>
                    openStory(story.id, getStoryLinkState(location.pathname, location.search))
                  }
                  className="w-full text-left rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 hover:border-orange-500/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        <MapPin size={12} className="text-orange-500" />
                        {getStoryLocationLabel(story)}
                      </div>
                      <div className="text-lg font-black text-slate-900 dark:text-white line-clamp-1">
                        {story.title}
                      </div>
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between gap-4">
                        <span className="truncate">{story.authorName || "Explorer"}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">
                          Score {getStoryScore(story)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.26em] font-bold text-sky-500">
                  Recently Approved
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  New stories to open next
                </h3>
              </div>
            </div>

            <div className="grid gap-4">
              {freshStories.map((story) => (
                <CompactStoryCard
                  key={story.id}
                  story={story}
                  eyebrow="Fresh"
                  onOpen={openStory}
                  fromState={getStoryLinkState(location.pathname, location.search)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <WhyJourneysPage onCreate={handleWrite} />

      <FinalCallToAction
        isLoggedIn={!!user}
        onPrimary={handleWrite}
        onSecondary={handleExplore}
      />
    </div>
  );
}
