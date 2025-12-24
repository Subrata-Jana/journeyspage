import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { 
  collection, doc, getDoc, getDocs, orderBy, query, addDoc, serverTimestamp, onSnapshot 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { motion, useScroll, useSpring } from "framer-motion"; 
import { 
  MapPin, Calendar, Flag, Mountain, Info, Lightbulb, User, 
  Utensils, BedDouble, Navigation, ArrowRight, X, ChevronLeft, ChevronRight, 
  QrCode, ShieldCheck, Share2, Heart, MessageSquare, Send, 
  ArrowLeft, Sun, Moon, Footprints, Check 
} from "lucide-react";
import * as LucideIcons from "lucide-react"; 
import toast from "react-hot-toast"; 
import { db } from "../services/firebase";
import { useMetaOptions } from "../hooks/useMetaOptions"; 

// --- HELPER: Get Color Hex from Name ---
const getColorHex = (name) => {
  const colors = {
    slate: '#64748b', red: '#ef4444', orange: '#f97316', amber: '#f59e0b',
    yellow: '#eab308', lime: '#84cc16', green: '#22c55e', emerald: '#10b981',
    teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6',
    indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef',
    pink: '#ec4899', rose: '#f43f5e'
  };
  return colors[name?.toLowerCase()] || '#94a3b8';
};

export default function StoryDetail() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); 
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  // ⚡ 1. FETCH ALL META DATA LISTS ⚡
  const { options: categories } = useMetaOptions("categories");
  const { options: tripTypes } = useMetaOptions("tripTypes");       // <-- ADDED
  const { options: difficulties } = useMetaOptions("difficultyLevels"); // <-- ADDED

  const [story, setStory] = useState(null);
  const [authorProfile, setAuthorProfile] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 💬 COMMENTS STATE
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // 🖼️ GALLERY & LIGHTBOX STATE
  const [fullGallery, setFullGallery] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [showQr, setShowQr] = useState(false);

  // 📊 REAL-TIME SOCIAL STATE
  const [isTracking, setIsTracking] = useState(false);
  const [trackersCount, setTrackersCount] = useState(0); 
  
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  const [hasShared, setHasShared] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  const isAdminView = location.state?.adminView === true;

  // 🌓 THEME STATE
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" || 
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // --- FETCH STORY & AUTHOR DATA ---
  useEffect(() => {
    if (!storyId) return;

    async function fetchStoryAndAuthor() {
      try {
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);

        if (!storySnap.exists()) {
          navigate("/dashboard");
          return;
        }

        const storyData = storySnap.data();
        
        if (!storyData.published && storyData.authorId !== currentUser?.uid && !isAdminView) {
          navigate("/dashboard");
          return;
        }

        setLikeCount(storyData.likes || 0);
        setShareCount(storyData.shares || 0);

        if (storyData.authorId) {
            try {
                const userDoc = await getDoc(doc(db, "users", storyData.authorId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setAuthorProfile(userData);
                    const realCount = userData.trackers ? userData.trackers.length : (userData.trackersCount || 0);
                    setTrackersCount(realCount);
                    if (currentUser && userData.trackers && userData.trackers.includes(currentUser.uid)) {
                        setIsTracking(true);
                    }
                }
            } catch (err) { console.error(err); }
        }

        const daysRef = collection(db, "stories", storyId, "days");
        const q = query(daysRef, orderBy("dayNumber", "asc"));
        const daysSnap = await getDocs(q);
        const daysData = daysSnap.docs.map(d => d.data());

        setStory({ id: storySnap.id, ...storyData });
        setDays(daysData);

        const allImages = [];
        if (storyData.coverImage) {
            allImages.push({ url: storyData.coverImage, caption: storyData.coverImageCaption || "Cover Photo" });
        }
        daysData.forEach(d => { 
            if (d.imageUrl) {
                allImages.push({ url: d.imageUrl, caption: d.imageCaption || `Day ${d.dayNumber}: ${d.title}` });
            }
        });
        if (storyData.gallery && Array.isArray(storyData.gallery)) {
            storyData.gallery.forEach(item => {
                if (typeof item === 'string') {
                    allImages.push({ url: item, caption: "" });
                } else {
                    allImages.push({ url: item.url, caption: item.caption || "" });
                }
            });
        }
        setFullGallery(allImages);

      } catch (err) {
        console.error("Error:", err);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchStoryAndAuthor();
  }, [storyId, navigate, currentUser, isAdminView]);

  // --- FETCH REAL-TIME COMMENTS ---
  useEffect(() => {
    if (!storyId) return;
    const commentsRef = collection(db, "stories", storyId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setComments(fetchedComments);
    });
    return () => unsubscribe();
  }, [storyId]);

  // --- SOCIAL HANDLERS ---
  const handleTrack = async () => {
    if (!currentUser) return toast.error("Please login to track scouts");
    const newStatus = !isTracking;
    setIsTracking(newStatus);
    setTrackersCount(prev => newStatus ? prev + 1 : prev - 1);
    if (newStatus) {
        toast.success("Tracking! Added to your Journey Radar.");
    } else {
        toast("Un-tracked. Removed from Radar.");
    }
  };

  const handleLike = () => {
    if (hasLiked) {
        setLikeCount(prev => prev - 1);
        setHasLiked(false);
    } else {
        setLikeCount(prev => prev + 1);
        setHasLiked(true);
        toast.success("Liked!");
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
    if (!hasShared) {
        setShareCount(prev => prev + 1);
        setHasShared(true);
    }
  };

  const handlePostComment = async () => {
      if (!newComment.trim()) return;
      if (!currentUser) return toast.error("Please login to comment");
      setSubmittingComment(true);
      try {
          await addDoc(collection(db, "stories", storyId, "comments"), {
              text: newComment,
              userId: currentUser.uid,
              userName: currentUser.displayName || "Explorer",
              userPhoto: currentUser.photoURL,
              createdAt: serverTimestamp()
          });
          setNewComment("");
          toast.success("Comment posted!");
      } catch (error) {
          console.error("Error posting comment:", error);
          toast.error("Failed to post comment");
      } finally {
          setSubmittingComment(false);
      }
  };

  // --- LIGHTBOX ---
  const openLightbox = (url) => {
    const idx = fullGallery.findIndex(img => img.url === url);
    if (idx !== -1) setLightboxIndex(idx);
  };
  const closeLightbox = () => setLightboxIndex(-1);
  const nextImage = useCallback((e) => {
    e?.stopPropagation();
    setLightboxIndex((prev) => (prev + 1) % fullGallery.length);
  }, [fullGallery.length]);
  const prevImage = useCallback((e) => {
    e?.stopPropagation();
    setLightboxIndex((prev) => (prev - 1 + fullGallery.length) % fullGallery.length);
  }, [fullGallery.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === -1) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, nextImage, prevImage]);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // ⚡ 2. DYNAMIC LOOKUP HELPERS ⚡
  // Match stored ID ("8") to Label ("Mountains")
  const categoryData = story?.category 
    ? categories.find(c => c.value === story.category || c.label === story.category) 
    : null;
    
  const tripTypeData = story?.tripType
    ? tripTypes.find(t => t.value === story.tripType || t.label === story.tripType)
    : null;

  const difficultyData = story?.difficulty
    ? difficulties.find(d => d.value === story.difficulty || d.label === story.difficulty)
    : null;

  const CategoryIcon = categoryData && LucideIcons[categoryData.icon] 
    ? LucideIcons[categoryData.icon] 
    : null;
    
  const categoryColor = categoryData ? getColorHex(categoryData.color) : "#fff";

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading Journey...</div>;
  if (!story) return null;

  return (
    <div className="bg-slate-50 dark:bg-[#0B0F19] min-h-screen pb-20 font-sans transition-colors duration-300">
      
      {/* ⚡ NEON READING BAR */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1.5 z-[100] bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 origin-left shadow-[0_0_15px_rgba(236,72,153,0.7)]"
        style={{ scaleX }}
      />

      {/* ⚡ FLOATING NAV CONTROLS */}
      <div className="fixed top-6 left-0 right-0 px-4 md:px-8 z-[90] flex justify-between items-center pointer-events-none">
          <button 
            onClick={() => navigate(-1)} 
            className="pointer-events-auto p-3 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:bg-black/40 hover:scale-105 transition-all shadow-lg group"
            title="Go Back"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform"/>
          </button>

          <button 
            onClick={() => setIsDark(!isDark)} 
            className="pointer-events-auto p-3 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:bg-black/40 hover:rotate-12 transition-all shadow-lg"
            title="Toggle Theme"
          >
            {isDark ? <Sun size={24} className="text-yellow-400"/> : <Moon size={24} />}
          </button>
      </div>

      {/* 🛡️ ADMIN PREVIEW BANNER */}
      {isAdminView && (
          <div className="bg-orange-600 text-white text-center py-2 px-4 text-sm font-bold sticky top-0 z-[60] shadow-md flex items-center justify-center gap-2 animate-in slide-in-from-top">
              <ShieldCheck size={16}/> ADMIN PREVIEW MODE
          </div>
      )}

      {/* --- 🎥 CINEMATIC CENTERED HERO --- */}
      <div className="relative h-[65vh] lg:h-[95vh] w-full bg-slate-900 overflow-hidden group">
        {story.coverImage ? (
          <motion.img 
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            src={story.coverImage} 
            alt={story.title} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">No Cover</div>
        )}
        
        {/* Cinematic Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/20 to-transparent" />
        
        {/* Hero Content - CENTERED */}
        <div className="absolute bottom-0 inset-0 z-20 left-0 w-full p-4 md:p-12 lg:p-20 pb-16 lg:pb-40 max-w-7xl mx-auto flex flex-col items-center justify-end h-full pointer-events-none text-center">
            
            <div className="pointer-events-auto space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                {/* Location Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs md:text-sm font-bold uppercase tracking-wider">
                    <MapPin size={12} md:size={14} className="text-orange-400"/>
                    {story.location}
                </div>

                {/* Massive Title */}
                <h1 className="text-4xl md:text-7xl lg:text-8xl font-black text-white leading-[1.1] md:leading-[0.9] tracking-tight drop-shadow-2xl">
                    {story.title}
                </h1>

                {/* Meta Bar - CENTERED */}
                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-white/90 font-medium text-sm md:text-lg pt-2 md:pt-4">
                    <div className="flex items-center gap-2.5">
                        <Calendar size={16} md:size={20} className="text-orange-400"/> {story.month}
                    </div>

                    {/* ⚡ DYNAMIC CATEGORY BADGE */}
                    {categoryData && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30 hidden md:block"/>
                          <div 
                            className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md"
                            style={{ backgroundColor: `${categoryColor}20` }}
                          >
                             {CategoryIcon && <CategoryIcon size={16} style={{ color: categoryColor }} />}
                             <span style={{ color: categoryColor }} className="font-bold text-sm">
                               {categoryData.label}
                             </span>
                          </div>
                        </>
                    )}

                    {/* ⚡ UPDATED: TRIP TYPE LOOKUP */}
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30 hidden md:block"/>
                    <div className="flex items-center gap-2.5">
                        <Flag size={16} md:size={20} className="text-emerald-400"/> 
                        {tripTypeData ? tripTypeData.label : story.tripType}
                    </div>

                    {/* ⚡ UPDATED: DIFFICULTY LOOKUP */}
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30 hidden md:block"/>
                    <div className="flex items-center gap-2.5">
                        <Mountain size={16} md:size={20} className="text-rose-400"/> 
                        {difficultyData ? difficultyData.label : story.difficulty}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      {/* ... (Rest of your component remains unchanged) ... */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10 mt-0 lg:-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* LEFT: Sticky Sidebar */}
            <div className="lg:col-span-4 space-y-6 md:space-y-8 h-fit lg:sticky lg:top-32 mt-0 lg:mt-32 order-1 lg:order-none">
                
                {/* 1. 🌟 PREMIUM AUTHOR & TRACKER CARD */}
                <div className="bg-white dark:bg-[#151b2b] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-white/5 relative overflow-hidden transition-colors duration-300">
                    {/* Author Header */}
                    <div className="flex items-center gap-4 md:gap-5 mb-6 md:mb-8">
                        <div className="relative shrink-0">
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full p-1 bg-white dark:bg-[#151b2b] shadow-lg">
                                <img 
                                    src={authorProfile?.photoURL || `https://ui-avatars.com/api/?name=${story.authorName}`} 
                                    className="w-full h-full rounded-full object-cover" 
                                    alt="Author"
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] md:text-xs font-bold text-orange-500 tracking-widest uppercase mb-1">
                                        {authorProfile?.badge || "SCOUT"}
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-none truncate pr-2">
                                        {story.authorName}
                                    </h3>
                                </div>
                                
                                {/* 👣 TRACK BUTTON */}
                                <button 
                                    onClick={handleTrack}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0
                                        ${isTracking 
                                            ? "bg-transparent border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400" 
                                            : "bg-orange-500 border-orange-500 text-white hover:bg-orange-600 shadow-md hover:shadow-lg"
                                        }
                                    `}
                                >
                                    {isTracking ? (
                                        <>Tracking <Check size={12}/></>
                                    ) : (
                                        <><Footprints size={12}/> Track +</>
                                    )}
                                </button>
                            </div>
                            
                            {/* Tracker Count (Dynamic) */}
                            <div className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${trackersCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}/>
                                {trackersCount} Trackers on Radar
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-white/5 w-full mb-6 md:mb-8" />

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duration</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{days.length}</span>
                                <span className="text-xs md:text-sm font-bold text-slate-400">Days</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cost</div>
                            <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                ₹{story.totalCost || "0"}
                            </div>
                        </div>
                    </div>

                    {/* Actions with Counts */}
                    <div className="flex gap-3 md:gap-4">
                        <button 
                            onClick={handleLike}
                            className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-sm md:text-base ${
                                hasLiked 
                                ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500" 
                                : "bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10"
                            }`}
                        >
                            <Heart size={18} md:size={20} className={hasLiked ? "fill-current" : ""} /> 
                            <span>{hasLiked ? "Liked" : "Like"}</span>
                            <span className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full text-xs ml-1 opacity-70">
                                {likeCount}
                            </span>
                        </button>
                        
                        <button 
                            onClick={handleShare}
                            className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl bg-[#0B0F19] dark:bg-white text-white dark:text-[#0B0F19] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg text-sm md:text-base hover:scale-[1.02]"
                        >
                            <Share2 size={18} md:size={20}/> 
                            <span>Share</span>
                            {shareCount > 0 && (
                                <span className="bg-white/20 dark:bg-black/10 px-2 py-0.5 rounded-full text-xs ml-1">
                                    {shareCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* 2. Map & QR */}
                <div className="bg-white dark:bg-[#151b2b] border border-slate-200 dark:border-white/5 p-2 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-lg transition-all cursor-pointer hidden md:block" onClick={() => setShowQr(!showQr)}>
                    <div className="bg-slate-100 dark:bg-black/20 rounded-xl md:rounded-2xl p-4 md:p-6 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white dark:bg-white/10 rounded-full flex items-center justify-center shadow-sm">
                                <QrCode size={20} className="text-slate-900 dark:text-white"/>
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm md:text-base">Mobile View</div>
                                <div className="text-xs text-slate-500">Tap to scan</div>
                            </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400 group-hover:translate-x-1 transition-transform"/>
                    </div>
                    {showQr && (
                        <motion.div initial={{height: 0, opacity:0}} animate={{height: "auto", opacity:1}} className="px-6 pb-6 pt-2">
                             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.href}`} alt="QR" className="w-full h-auto rounded-xl border border-slate-100 dark:border-white/5"/>
                        </motion.div>
                    )}
                </div>

                {/* 3. Info Cards */}
                {(story.aboutPlace || story.specialNote) && (
                    <div className="space-y-4">
                        {story.aboutPlace && (
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-orange-100 dark:border-orange-500/10 p-5 md:p-6 rounded-2xl md:rounded-3xl">
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold mb-2 md:mb-3 text-sm md:text-base">
                                    <Info size={18}/> About The Place
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed opacity-90">{story.aboutPlace}</p>
                            </div>
                        )}
                        {story.specialNote && (
                            <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/10 dark:to-pink-900/10 border border-rose-100 dark:border-rose-500/10 p-5 md:p-6 rounded-2xl md:rounded-3xl">
                                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-500 font-bold mb-2 md:mb-3 text-sm md:text-base">
                                    <Lightbulb size={18}/> Pro Tips
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed opacity-90">{story.specialNote}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* RIGHT: Main Content (Days) */}
            <div className="lg:col-span-8 space-y-12 lg:mt-32 order-2 lg:order-none">
                {days.map((day, i) => (
                    <div key={i} className="group relative pl-6 md:pl-8 border-l-2 border-slate-200 dark:border-white/10 last:border-0 pb-12">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-white dark:ring-[#0B0F19]"/>

                        <div className="mb-4 md:mb-6">
                            <span className="text-orange-500 font-bold text-xs md:text-sm tracking-widest uppercase mb-1 md:mb-2 block">Day {day.dayNumber}</span>
                            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">{day.title}</h2>
                        </div>

                        {/* Image */}
                        {day.imageUrl && (
                            <div className="w-full aspect-[16/9] rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-8 shadow-2xl relative cursor-zoom-in group/img" onClick={() => openLightbox(day.imageUrl)}>
                                <img src={day.imageUrl} alt="Day" className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"/>
                                {day.imageCaption && (
                                    <div className="absolute bottom-3 left-4 md:bottom-4 md:left-6 bg-black/60 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full text-white text-[10px] md:text-xs font-medium border border-white/10">
                                        {day.imageCaption}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="prose dark:prose-invert max-w-none">
                            <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                {day.story}
                            </p>
                        </div>

                        {/* Highlight */}
                        {day.highlight && (
                            <div className="mt-6 md:mt-8 p-5 md:p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border-l-4 border-orange-500 italic text-slate-600 dark:text-slate-300 text-sm md:text-base">
                                <span className="block text-orange-500 font-bold text-[10px] md:text-xs uppercase tracking-wider mb-2">Highlight</span>
                                "{day.highlight}"
                            </div>
                        )}

                        {/* 🍽️ Food & Dining */}
                        {day.food && (
                            <div className="mt-6 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-500/20">
                                <div className="w-12 h-12 rounded-full bg-white dark:bg-emerald-500/20 flex items-center justify-center shadow-sm shrink-0">
                                    <Utensils size={20} className="text-emerald-600 dark:text-emerald-400"/>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-0.5">On The Menu</div>
                                    <div className="text-base font-bold text-slate-700 dark:text-slate-200">{day.food}</div>
                                </div>
                            </div>
                        )}

                        {/* Logistics Grid */}
                        {(day.departure || day.stay) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                {day.departure && (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-white/5 shadow-sm">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-lg"><Navigation size={18}/></div>
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            <span className="block text-[10px] text-slate-400 uppercase font-bold">Route</span>
                                            {day.departure} → {day.destination}
                                        </div>
                                    </div>
                                )}
                                {day.stay && (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-white/5 shadow-sm">
                                        <div className="p-2 bg-purple-50 dark:bg-purple-500/10 text-purple-500 rounded-lg"><BedDouble size={18}/></div>
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            <span className="block text-[10px] text-slate-400 uppercase font-bold">Stay</span>
                                            {day.stay}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* --- VIDEO SECTION --- */}
        {story.youtubeLink && getYoutubeId(story.youtubeLink) && (
            <div className="mt-20 md:mt-24 max-w-5xl mx-auto">
                <div className="flex items-center gap-4 mb-6 md:mb-8 justify-center">
                    <span className="w-12 md:w-16 h-1 bg-red-600 rounded-full"/>
                    <h3 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">The Experience</h3>
                    <span className="w-12 md:w-16 h-1 bg-red-600 rounded-full"/>
                </div>
                <div className="rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-2xl bg-black aspect-video border-4 border-white dark:border-[#151b2b]">
                    <iframe 
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${getYoutubeId(story.youtubeLink)}`} 
                        title="Trip Video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        )}

        {/* --- GALLERY --- */}
        {fullGallery.length > 0 && (
            <div className="mt-24 md:mt-32 max-w-[1400px] mx-auto px-0 md:px-6">
                <div className="flex items-center justify-between mb-8 md:mb-10 px-4 md:px-0">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Visual Diary</h3>
                    <span className="text-slate-500 font-medium text-sm md:text-base">{fullGallery.length} Photos</span>
                </div>
                <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-6 space-y-3 md:space-y-6">
                    {fullGallery.map((img, idx) => (
                        <motion.div 
                            whileHover={{ y: -5 }}
                            key={idx} 
                            onClick={() => openLightbox(img.url)}
                            className="break-inside-avoid rounded-xl md:rounded-2xl overflow-hidden cursor-zoom-in relative group shadow-lg"
                        >
                            <img src={img.url} alt="Gallery" className="w-full h-auto transform transition-transform duration-700 group-hover:scale-110"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"/>
                        </motion.div>
                    ))}
                </div>
            </div>
        )}

        {/* --- 💬 COMMENTS SECTION (NEW) --- */}
        <div className="mt-24 md:mt-32 max-w-4xl mx-auto px-4 md:px-6 border-t border-slate-200 dark:border-white/10 pt-16">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-8">Discussion ({comments.length})</h3>

            {/* Input */}
            <div className="bg-white dark:bg-[#151b2b] p-3 md:p-2 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-white/5 shadow-lg mb-10 md:mb-12 flex flex-col md:flex-row gap-4 items-start">
                <div className="hidden md:block w-12 h-12 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden shrink-0 ml-2 mt-2">
                    {currentUser?.photoURL ? (
                        <img src={currentUser.photoURL} className="w-full h-full object-cover" alt="Me" />
                    ) : (
                        <User className="w-full h-full p-3 text-slate-400"/>
                    )}
                </div>
                <div className="flex-1 w-full">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Join the conversation..."
                        className="w-full bg-transparent border-none focus:ring-0 p-2 md:p-4 min-h-[80px] text-slate-900 dark:text-white text-base md:text-lg placeholder:text-slate-400 resize-none"
                    />
                    <div className="flex justify-between items-center px-2 md:px-4 pb-2">
                        <span className="text-[10px] md:text-xs text-slate-400 font-medium">Markdown supported</span>
                        <button 
                            onClick={handlePostComment}
                            disabled={submittingComment || !newComment.trim()}
                            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 md:px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 text-sm"
                        >
                            {submittingComment ? "Posting..." : <><Send size={14}/> Post</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="space-y-6 md:space-y-8">
                {comments.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                        <MessageSquare size={40} className="text-slate-300 mx-auto mb-3"/>
                        <p className="text-slate-500 font-medium">No comments yet. Start the chat!</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 md:gap-4 group">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden shrink-0">
                                {comment.userPhoto ? (
                                    <img src={comment.userPhoto} className="w-full h-full object-cover" alt={comment.userName} />
                                ) : (
                                    <User className="w-full h-full p-2 text-slate-400"/>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-900 dark:text-white text-sm">{comment.userName}</span>
                                    <span className="text-xs text-slate-400">•</span>
                                    <span className="text-[10px] md:text-xs text-slate-400">
                                        {comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString() : "Just now"}
                                    </span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-[15px]">{comment.text}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>

      {/* --- LIGHTBOX MODAL --- */}
      {lightboxIndex !== -1 && (
        <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300" onClick={closeLightbox}>
            <button onClick={closeLightbox} className="absolute top-4 right-4 md:top-6 md:right-6 text-white/50 hover:text-white p-2 md:p-4 transition-colors z-50">
                <X size={24} md:size={32} />
            </button>

            <button onClick={prevImage} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 md:p-6 transition-all hidden md:block z-50">
                <ChevronLeft size={64} />
            </button>
            <button onClick={nextImage} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 md:p-6 transition-all hidden md:block z-50">
                <ChevronRight size={64} />
            </button>

            <div className="relative max-w-[95vw] max-h-[80vh] md:max-h-[95vh] w-full h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <img 
                    src={fullGallery[lightboxIndex].url} 
                    alt="Full View" 
                    className="max-w-full max-h-full object-contain shadow-2xl"
                />
                {fullGallery[lightboxIndex].caption && (
                    <div className="absolute bottom-4 md:bottom-10 bg-black/50 backdrop-blur-md px-4 py-2 md:px-6 md:py-3 rounded-full text-white text-xs md:text-sm font-medium border border-white/10 text-center max-w-[90%]">
                        {fullGallery[lightboxIndex].caption}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}

// --- SUB COMPONENTS ---
const Badge = ({ icon, text, color }) => (
  text ? <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-sm ${color}`}>{icon} {text}</span> : null
);