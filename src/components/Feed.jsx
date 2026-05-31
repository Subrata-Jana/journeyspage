import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { 
  MapPin, UserPlus, UserCheck, Loader2, 
  Mountain, Flag, Calendar, Wallet, ChevronRight, Clock, Gift, Filter, Search, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import { fetchGameRules, calculateRank } from "../utils/gameRules";
import { toggleUserTrack } from "../services/gamificationService";
import { useMetaOptions } from "../hooks/useMetaOptions"; // ⚡ IMPORTED FOR FILTERS

const getStoryLocationMeta = (story) => story?.locationData?.value || story?.locationData || {};

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const getStoryLocationTokens = (story) => {
  const locationMeta = getStoryLocationMeta(story);
  const metaTokens = Array.isArray(locationMeta.searchTokens)
    ? locationMeta.searchTokens
    : [];

  return Array.from(
    new Set(
      [
        story.location,
        story.state,
        story.country,
        locationMeta.displayLabel,
        locationMeta.placeName,
        locationMeta.locality,
        locationMeta.district,
        locationMeta.state,
        locationMeta.country,
        ...metaTokens,
      ]
        .filter(Boolean)
        .flatMap(tokenize)
    )
  );
};

const getStorySearchTokens = (story) =>
  Array.from(
    new Set([
      ...getStoryLocationTokens(story),
      ...tokenize(story.title),
      ...tokenize(story.tripType),
      ...tokenize(story.category),
    ])
  );

const matchesStorySearch = (story, searchText) =>
  !searchText || getStorySearchTokens(story).some((token) => token.includes(searchText));

const matchesStoryLocation = (story, searchText) =>
  !searchText || getStoryLocationTokens(story).some((token) => token.includes(searchText));

const getBudgetNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeLookupKey = (value) => String(value || "").trim().toLowerCase();

const getOptionValue = (option) => option?.value ?? option?.id ?? option?.label ?? option?.name ?? "";

const resolveOptionLabel = (options = [], value) => {
  if (value === null || value === undefined || value === "") return "";
  const key = normalizeLookupKey(value);
  const match = options.find((option) =>
    [option.value, option.id, option.label, option.name]
      .filter(Boolean)
      .some((candidate) => normalizeLookupKey(candidate) === key)
  );
  return match?.label || match?.name || String(value);
};

const formatBudgetCompact = (value, basis = "total_trip") => {
  const numeric = getBudgetNumber(value);
  if (!numeric) return { main: "Not listed", sub: "" };
  const shortValue =
    numeric >= 100000
      ? `${(numeric / 100000).toFixed(numeric % 100000 === 0 ? 0 : 1)}L`
      : numeric >= 1000
        ? `${Math.round(numeric / 1000)}k`
        : numeric.toLocaleString();
  return {
    main: `INR ${shortValue}`,
    sub: basis === "per_person" ? "/ person" : "/ trip",
  };
};

const formatJourneyDate = (value) => {
  if (!value) return "N/A";
  const text = String(value).trim();
  const ddmmyyyy = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = ddmmyyyy[3] ? Number(String(ddmmyyyy[3]).padStart(4, "20")) : new Date().getFullYear();
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
    }
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return text;
};

let cachedRanksPromise = null;

const getCachedRanks = async () => {
  if (!cachedRanksPromise) {
    cachedRanksPromise = fetchGameRules().then(({ ranks }) => ranks || []);
  }
  return cachedRanksPromise;
};

const resolveRankName = async (userData, fallbackRank = "Scout") => {
  const directRank =
    (typeof userData?.currentRank === "string" && userData.currentRank) ||
    userData?.currentRank?.name ||
    userData?.badge;

  if (directRank) return directRank;

  const xp = Number(userData?.xp ?? 0);
  const ranks = await getCachedRanks();
  if (!ranks.length) return fallbackRank;

  return calculateRank(ranks, xp)?.name || fallbackRank;
};

export default function Feed({ activeTab = "explore" }) {
  const { user } = useAuth(); 
  const navigate = useNavigate();
  
  // ⚡ FILTER STATES
  const [filters, setFilters] = useState({
      search: "",
      location: "",
      difficulty: "",
      tripType: "",
      category: "",
      maxBudget: ""
  });
  const initialFiltersRef = useRef(filters);
  const [showFilters, setShowFilters] = useState(false);

  // ⚡ OPTIONS FOR DROPDOWNS
  const { options: difficulties } = useMetaOptions("difficultyLevels");
  const { options: tripTypes } = useMetaOptions("tripTypes");
  const { options: categories } = useMetaOptions("categories");

  const [stories, setStories] = useState([]);
  const [sourceStories, setSourceStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingList, setTrackingList] = useState([]); 

  // --- 1. FETCH USER'S TRACKING LIST ---
  useEffect(() => {
    if (user) {
        const fetchTrackingList = async () => {
            try {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    setTrackingList(userSnap.data().tracking || []);
                }
            } catch (err) { console.error("Error fetching tracking list:", err); }
        };
        fetchTrackingList();
    }
  }, [user]);

  // --- 2. FETCH STORIES (With Client-Side Filtering) ---
  useEffect(() => {
    const fetchStories = async () => {
      setLoading(true);
      setStories([]); 

      try {
        const storiesRef = collection(db, "stories");
        let q;

        // ⚡ BASE QUERY: Status = Approved
        if (activeTab === "tracking") {
            if (trackingList.length === 0) { setLoading(false); return; }
            const safeTrackingList = trackingList.slice(0, 10); 
            q = query(storiesRef, where("status", "==", "approved"), where("authorId", "in", safeTrackingList), orderBy("createdAt", "desc"), limit(50));
        } else {
            q = query(storiesRef, where("status", "==", "approved"), orderBy("createdAt", "desc"), limit(50));
        }

        const querySnapshot = await getDocs(q);
        
        // ⚡ CLIENT-SIDE FILTERING LOGIC
        const rawStories = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        const filteredStories = rawStories.filter(story => {
            // Text Search
            const searchText = initialFiltersRef.current.search.toLowerCase().trim();
            const matchesSearch = matchesStorySearch(story, searchText);
            
            // ⚡ SMART LOCATION FILTER
            // Checks City OR State OR Country
            const locFilter = initialFiltersRef.current.location.toLowerCase().trim();
            const matchesLocation = matchesStoryLocation(story, locFilter);
            // Dropdowns
            const matchesDifficulty = !initialFiltersRef.current.difficulty || story.difficulty === initialFiltersRef.current.difficulty;
            const matchesType = !initialFiltersRef.current.tripType || story.tripType === initialFiltersRef.current.tripType;
            const matchesCategory = !initialFiltersRef.current.category || story.category === initialFiltersRef.current.category;

            // Budget
            const maxBudget = getBudgetNumber(initialFiltersRef.current.maxBudget);
            const storyBudget = getBudgetNumber(story.totalCost);
            const matchesBudget = !maxBudget || (storyBudget > 0 && storyBudget <= maxBudget);

            return matchesSearch && matchesLocation && matchesDifficulty && matchesType && matchesCategory && matchesBudget;
        });

        setSourceStories(rawStories);
        setStories(filteredStories);

      } catch (error) { console.error("Error loading feed:", error); } finally { setLoading(false); }
    };

    if (activeTab === "explore" || (activeTab === "tracking" && trackingList !== undefined)) {
        fetchStories();
    }
    
  }, [activeTab, trackingList]);

  useEffect(() => {
    const searchText = filters.search.toLowerCase().trim();
    const locFilter = filters.location.toLowerCase().trim();
    setStories(sourceStories.filter(story => {
      const matchesSearch = matchesStorySearch(story, searchText);
      const matchesLocation = matchesStoryLocation(story, locFilter);
      const matchesDifficulty = !filters.difficulty || story.difficulty === filters.difficulty;
      const matchesType = !filters.tripType || story.tripType === filters.tripType;
      const matchesCategory = !filters.category || story.category === filters.category;
      const maxBudget = getBudgetNumber(filters.maxBudget);
      const storyBudget = getBudgetNumber(story.totalCost);
      const matchesBudget = !maxBudget || (storyBudget > 0 && storyBudget <= maxBudget);
      return matchesSearch && matchesLocation && matchesDifficulty && matchesType && matchesCategory && matchesBudget;
    }));
  }, [filters, sourceStories]);

  const handleToggleTrack = async (authorId) => {
    if (!user) return toast.error("Please login to track scouts");
    if (user.uid === authorId) return toast.error("You cannot track yourself");

    try {
        const result = await toggleUserTrack(authorId);
        if (!result.success) throw result.error || new Error("track-failed");

        if (result.isTracking) {
            setTrackingList(prev => [...new Set([...prev, authorId])]);
            toast.success(`Following Scout! (+${result.xpGained || 0} XP)`);
        } else {
            setTrackingList(prev => prev.filter(id => id !== authorId));
            toast.success("Unfollowed Scout");
        }
    } catch (error) { toast.error("Failed to update tracking"); }
  };

  const clearFilters = () => setFilters({ search: "", location: "", difficulty: "", tripType: "", category: "", maxBudget: "" });

  return (
    <div className="w-full pb-20 px-4">
      {/* ⚡ FILTER BAR (Only on Explore) */}
      {activeTab === 'explore' && (
          <div className="max-w-7xl mx-auto mb-8 space-y-4">
              <div className="flex gap-4">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                      <input type="text" placeholder="Search titles, places, states, countries..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 focus:border-orange-500 outline-none text-slate-900 dark:text-white" value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
                  </div>
                  <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-3 rounded-xl border flex items-center gap-2 font-bold transition-all ${showFilters ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white dark:bg-[#111625] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-orange-500'}`}>
                      <Filter size={18}/> Filters
                  </button>
              </div>

              <AnimatePresence>
                  {showFilters && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="p-5 bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-white/10 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                              <input type="text" placeholder="Place / State / Country" className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none" value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})} />
                              <select className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none text-slate-900 dark:text-white" value={filters.difficulty} onChange={e => setFilters({...filters, difficulty: e.target.value})}>
                                  <option value="">Any Difficulty</option>
                                  {difficulties.map(o => <option key={getOptionValue(o)} value={getOptionValue(o)}>{o.label}</option>)}
                              </select>
                              <select className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none text-slate-900 dark:text-white" value={filters.tripType} onChange={e => setFilters({...filters, tripType: e.target.value})}>
                                  <option value="">Any Type</option>
                                  {tripTypes.map(o => <option key={getOptionValue(o)} value={getOptionValue(o)}>{o.label}</option>)}
                              </select>
                              <select className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none text-slate-900 dark:text-white" value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
                                  <option value="">Any Category</option>
                                  {categories.map(o => <option key={getOptionValue(o)} value={getOptionValue(o)}>{o.label}</option>)}
                              </select>
                              <input type="number" placeholder="Max budget (INR)" className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none" value={filters.maxBudget} onChange={e => setFilters({...filters, maxBudget: e.target.value})} />
                              
                              <div className="md:col-span-3 lg:col-span-5 flex justify-end">
                                  <button onClick={clearFilters} className="text-sm font-bold text-red-500 hover:text-red-400 flex items-center gap-1"><X size={14}/> Clear All</button>
                              </div>
                          </div>
                      </motion.div>
                  )}
              </AnimatePresence>
          </div>
      )}

      {loading ? (
          <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 size={32} className="animate-spin text-orange-500 mb-2"/>
              <p className="text-sm font-medium">Scanning Journey Radar...</p>
          </div>
      ) : stories.length === 0 ? (
          activeTab === "tracking" ? <EmptyTrackingState /> : <div className="text-center py-20 text-slate-500"><p className="text-lg font-medium text-slate-900 dark:text-white">No journeys found matching your criteria.</p></div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mx-auto max-w-7xl">
            <AnimatePresence>
              {stories.map((story, index) => (
                <NeonMagnetCard 
                    key={story.id} story={story} index={index} navigate={navigate} 
                    isTracking={trackingList.includes(story.authorId)}
                    onToggleTrack={() => handleToggleTrack(story.authorId)}
                    currentUser={user}
                    optionMaps={{ tripTypes, difficulties, categories }}
                />
              ))}
            </AnimatePresence>
          </div>
      )}
    </div>
  );
}

function NeonMagnetCard({ story, index, navigate, isTracking, onToggleTrack, currentUser, optionMaps }) {
  const [imgError, setImgError] = useState(false);
  
  // ⚡ OPTIMIZATION: Use stored data first (Instant Load)
  const [avatarUrl, setAvatarUrl] = useState(story.authorPhoto || story.authorImage || story.photoURL || null);
  const [authorRank, setAuthorRank] = useState(story.authorRank || "Scout");

  let mouseX = useMotionValue(0);
  let mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  // ⚡ FALLBACK LOGIC: Only fetch from DB if data is missing (Old Stories)
  useEffect(() => {
    // If we already have the Rank AND Photo, DO NOT fetch.
    if (authorRank !== "Scout" && avatarUrl) return; 
    
    if (!story.authorId) return;

    const fetchAuthorData = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", story.authorId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Update State locally
          const livePhoto =
            userData.photoURL ||
            userData.avatarUrl ||
            userData.profilePhoto ||
            userData.avatar;
          if (livePhoto && !avatarUrl) { setAvatarUrl(livePhoto); setImgError(false); }

          const rank = await resolveRankName(userData, story.authorRank || "Scout");
          if (rank) setAuthorRank(rank);
        }
      } catch (err) { console.log("Err fetching author data", err); }
    };
    
    fetchAuthorData();
  }, [story.authorId]); // Removed extra dependencies to prevent loops

  const authorName = story.authorName || "Explorer";
  const authorInitials = authorName.substring(0, 2).toUpperCase();
  const showImage = avatarUrl && !imgError;
  const displayImage = story.coverImage || "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=1000";
  const budget = formatBudgetCompact(story.totalCost, story.budgetBasis);
  const when = formatJourneyDate(story.month);
  const level = resolveOptionLabel(optionMaps?.difficulties, story.difficulty) || "Open";
  const tripType = resolveOptionLabel(optionMaps?.tripTypes, story.tripType) || resolveOptionLabel(optionMaps?.categories, story.category);
  const daysCount = story.tripDurationDays || story.durationDays || story.itineraryEntryCount || null;
  
  // ⚡ GIFT COUNT LOGIC ⚡
  // We assume 'giftCount' is on the story object. If not, default to 0.
  const giftCount = story.giftCount || story.tributeCount || 0;

  const handleCardClick = () => navigate(`/story/${story.id}`);
  const handleProfileClick = (e) => { e.preventDefault(); e.stopPropagation(); if (story.authorId) navigate(`/profile/${story.authorId}`); };
  const handleTrackClick = (e) => { e.preventDefault(); e.stopPropagation(); onToggleTrack(); };

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }} className="group relative bg-[#111827] dark:bg-[#0f172a] rounded-[1.55rem] border border-slate-800/90 shadow-[0_18px_45px_rgba(15,23,42,0.18)] cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.28)] hover:border-orange-500/30" onClick={handleCardClick} onMouseMove={handleMouseMove}>
      <motion.div className="pointer-events-none absolute -inset-px rounded-[1.5rem] opacity-0 transition duration-300 group-hover:opacity-100" style={{ background: useMotionTemplate`radial-gradient(650px circle at ${mouseX}px ${mouseY}px, rgba(249, 115, 22, 0.15), transparent 80%)` }} />
      <motion.div className="pointer-events-none absolute -inset-px rounded-[1.5rem] opacity-0 transition duration-300 group-hover:opacity-100" style={{ background: useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(249, 115, 22, 0.4), transparent 40%)`, zIndex: 0 }} />

      <div className="relative flex flex-col h-full bg-[#111827] dark:bg-[#0f172a] rounded-[1.4rem] z-10 m-[1px] overflow-hidden">
          <div className="relative w-full aspect-[4/4] overflow-hidden bg-slate-800">
            <motion.img src={displayImage} alt={story.title} className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-hover:brightness-110"/>
            <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/10 to-black/35 opacity-80" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#111827] to-transparent" />
            <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2">
                {tripType && (<div className="max-w-[70%] truncate px-2.5 py-1 rounded-full bg-black/58 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg"><Flag size={10} className="shrink-0 text-orange-400"/> <span className="truncate">{tripType}</span></div>)}
                {daysCount && <div className="px-2.5 py-1 rounded-full bg-black/58 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg"><Clock size={10} className="text-sky-400"/> {daysCount} Days</div>}
            </div>
            
            {/* ⚡ RECTIFICATION 5: GIFT COUNT BADGE ⚡ */}
            {giftCount > 0 && (
                <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-yellow-500/20 backdrop-blur-md border border-yellow-500/50 text-yellow-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Gift size={10} className="fill-current"/> {giftCount}
                </div>
            )}
          </div>

          <div className="flex flex-col flex-1 p-5 pt-4">
            <h3 className="min-h-[3.25rem] text-lg font-bold text-white leading-snug mb-1 line-clamp-2 group-hover:text-orange-400 transition-colors">{story.title}</h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-4"><MapPin size={12} className="text-orange-500 shrink-0" /> <span className="truncate">{story.location || "Unknown Location"}</span></div>
            <div className="mb-4 rounded-xl border border-slate-800/80 bg-[#172033]/55 p-2.5 shadow-inner">
                <div className="grid grid-cols-[0.95fr_1.05fr_auto] gap-2">
                    <div className="min-w-0 rounded-lg bg-white/[0.035] px-2.5 py-2">
                        <span className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500"><Calendar size={10}/> When</span>
                        <span className="block truncate text-sm font-black text-slate-100">{when}</span>
                    </div>
                    <div className="min-w-0 rounded-lg bg-white/[0.035] px-2.5 py-2">
                        <span className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500"><Wallet size={10}/> Budget</span>
                        <span className="block truncate text-sm font-black leading-none text-slate-100">{budget.main}</span>
                        {budget.sub && <span className="mt-0.5 block text-[10px] font-bold text-slate-500">{budget.sub}</span>}
                    </div>
                    <div className="min-w-[4.35rem] rounded-lg bg-white/[0.035] px-2.5 py-2">
                        <span className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500"><Mountain size={10}/> Level</span>
                        <span className={`block max-w-[4.8rem] truncate text-sm font-black ${level.toLowerCase().includes('hard') || level.toLowerCase().includes('extreme') ? 'text-red-400' : 'text-emerald-400'}`}>{level}</span>
                    </div>
                </div>
            </div>
            <div className="mt-auto flex items-center justify-between pt-1">
                <div className="flex min-w-0 items-center gap-2.5 cursor-pointer group/author" onClick={handleProfileClick}>
                    <div className={`w-8 h-8 rounded-full overflow-hidden border border-slate-600 group-hover/author:border-orange-500 transition-colors ${isTracking ? 'ring-1 ring-orange-500' : ''}`}>{showImage ? (<img src={avatarUrl} onError={() => setImgError(true)} className="w-full h-full object-cover" alt={authorName} />) : (<div className="w-full h-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">{authorInitials}</div>)}</div>
                    <div className="flex min-w-0 flex-col"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{authorRank || "Scout"}</span><span className="truncate text-xs font-bold text-slate-300 group-hover/author:text-white transition-colors">{authorName}</span></div>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                    {currentUser && currentUser.uid !== story.authorId && (
                        <button onClick={handleTrackClick} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${isTracking ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" : "bg-white/5 text-slate-300 border-white/10 hover:bg-orange-500 hover:text-white hover:border-orange-500"}`} title={isTracking ? "Following traveler" : "Follow traveler"}>
                            {isTracking ? <UserCheck size={13} /> : <UserPlus size={13} />}
                            <span className="hidden 2xl:inline">{isTracking ? "Following" : "Track"}</span>
                        </button>
                    )}
                    <button className="text-orange-500 hover:text-white hover:bg-orange-500 p-1.5 rounded-full transition-all" title="Open journey"><ChevronRight size={18} /></button>
                </div>
            </div>
          </div>
      </div>
    </motion.div>
  );
}

function EmptyTrackingState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500 bg-white/5 dark:bg-[#111625]/50 rounded-3xl border border-dashed border-slate-300 dark:border-white/10 mx-auto max-w-lg mt-10">
            <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 relative"><div className="absolute inset-0 border border-dashed border-slate-300 dark:border-white/20 rounded-full animate-spin-slow"/><UserPlus size={32} className="text-slate-400"/></div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Community Radar Empty</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">You aren't tracking any travelers yet. Switch to the <b>Explore</b> tab to find scouts and click the <UserPlus size={14} className="inline"/> button.</p>
        </div>
    )
}
