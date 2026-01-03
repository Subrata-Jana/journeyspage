import React, { useEffect, useState, useContext, createContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { 
  collection, doc, getDoc, getDocs, orderBy, query, updateDoc, onSnapshot 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion"; 
import { 
  MapPin, Calendar, Flag, Mountain, Info, Lightbulb, User, 
  Utensils, BedDouble, Navigation, ChevronRight, 
  QrCode, ShieldCheck, Share2, Heart, MessageSquare, Send, 
  ArrowLeft, Sun, Moon, Footprints, Check, Globe2, ShieldAlert, RotateCcw, X, AlertTriangle, AlertCircle, Edit3, Hammer, SearchCheck
} from "lucide-react";
import * as LucideIcons from "lucide-react"; 
import toast, { Toaster } from "react-hot-toast"; 
import { db } from "../services/firebase";
import { useMetaOptions } from "../hooks/useMetaOptions"; 
import GallerySlider from "../components/GallerySlider"; 

// --- CONTEXT FOR SMART REVIEW ---
const ReviewContext = createContext();

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
  
  // ⚡ META DATA LISTS
  const { options: categories } = useMetaOptions("categories");
  const { options: tripTypes } = useMetaOptions("tripTypes");       
  const { options: difficulties } = useMetaOptions("difficultyLevels");

  const [story, setStory] = useState(null);
  const [authorProfile, setAuthorProfile] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 💬 COMMENTS & SOCIAL STATE
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackersCount, setTrackersCount] = useState(0); 
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [hasShared, setHasShared] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  // 🖼️ GALLERY & LIGHTBOX STATE
  const [fullGallery, setFullGallery] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [showQr, setShowQr] = useState(false);

  // 🛡️ ADMIN / AUTHOR REVIEW STATE
  const isAdminView = location.state?.adminView === true;
  const [feedback, setFeedback] = useState({}); 
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // ✍️ AUTHOR EDIT MODE CHECK
  const [isAuthorView, setIsAuthorView] = useState(false);

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
    if (isDark) { root.classList.add("dark"); localStorage.setItem("theme", "dark"); } 
    else { root.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [isDark]);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // ⚡ DETECT RESUBMISSION (For Blue Flags)
  const isResubmission = story?.status === 'pending' && story?.feedback && Object.keys(story.feedback).length > 0;

  // --- FETCH STORY & AUTHOR & FEEDBACK ---
  useEffect(() => {
    if (!storyId) return;

    async function fetchStoryAndAuthor() {
      try {
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);

        if (!storySnap.exists()) { navigate("/dashboard"); return; }

        const storyData = storySnap.data();
        
        // ⚡ DETECT IF AUTHOR IS VIEWING A RETURNED STORY
        const isAuthor = currentUser?.uid === storyData.authorId;
        const isReturned = storyData.status === 'returned';
        setIsAuthorView(isAuthor && isReturned);

        // Load feedback if it exists (Source of Truth)
        if (storyData.feedback) setFeedback(storyData.feedback);

        // Access Control
        if (!storyData.published && !isAuthor && !isAdminView) {
          navigate("/dashboard"); return;
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

        // --- BUILD UNIFIED GALLERY ---
        const allImages = [];
        if (storyData.coverImage) allImages.push({ url: storyData.coverImage, caption: storyData.coverImageCaption || "Cover Photo", is360: false });
        daysData.forEach(d => { if (d.imageUrl) allImages.push({ url: d.imageUrl, caption: d.imageCaption || `Day ${d.dayNumber}: ${d.title}`, is360: false }); });
        if (storyData.gallery && Array.isArray(storyData.gallery)) {
            storyData.gallery.forEach(item => {
                if (typeof item === 'string') allImages.push({ url: item, caption: "", is360: false });
                else allImages.push({ url: item.url, caption: item.caption || "", is360: item.is360 || false });
            });
        }
        setFullGallery(allImages);

      } catch (err) { console.error("Error:", err); navigate("/dashboard"); } finally { setLoading(false); }
    }
    fetchStoryAndAuthor();
  }, [storyId, navigate, currentUser, isAdminView]);

  // --- COMMENTS LISTENER ---
  useEffect(() => {
    if (!storyId) return;
    const commentsRef = collection(db, "stories", storyId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [storyId]);

  // --- PLACEHOLDERS FOR SOCIAL ACTIONS ---
  const handleTrack = async () => { /* Add tracking logic */ };
  const handleLike = () => { /* Add like logic */ };
  const handleShare = () => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); };
  const handlePostComment = async () => { /* Add comment logic */ };

  // --- 🛡️ REVIEW HANDLERS ---
  const toggleFeedback = (fieldId, comment) => {
    if (!isAdminView) return; 
    setFeedback(prev => {
        const next = { ...prev };
        if (!comment) delete next[fieldId];
        else next[fieldId] = comment;
        return next;
    });
  };

  // --- 🛡️ ADMIN ACTIONS ---
  const processApprove = async () => {
    setIsSubmittingReview(true);
    try {
        await updateDoc(doc(db, "stories", storyId), {
            status: 'approved',
            published: true,
            feedback: {}, 
            adminNotes: ""
        });
        toast.success("Story Published Successfully!");
        navigate("/admin");
    } catch (error) {
        toast.error("Failed to approve");
    } finally {
        setIsSubmittingReview(false);
    }
  };

  const processReturn = async () => {
    setIsSubmittingReview(true);
    try {
        await updateDoc(doc(db, "stories", storyId), {
            status: 'returned',
            published: false,
            feedback: feedback, 
            adminNotes: "Please address the flagged issues."
        });
        toast.success("Story returned to author");
        navigate("/admin");
    } catch (error) {
        toast.error("Failed to return story");
    } finally {
        setIsSubmittingReview(false);
    }
  };

  const handleEditRedirect = () => { navigate(`/create-story?edit=${storyId}`); };

  const getYoutubeId = (url) => {
    if(!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Helper Lookups
  const categoryData = story?.category ? categories.find(c => c.value === story.category || c.label === story.category) : null;
  const tripTypeData = story?.tripType ? tripTypes.find(t => t.value === story.tripType || t.label === story.tripType) : null;
  const difficultyData = story?.difficulty ? difficulties.find(d => d.value === story.difficulty || d.label === story.difficulty) : null;
  const CategoryIcon = categoryData && LucideIcons[categoryData.icon] ? LucideIcons[categoryData.icon] : null;
  const categoryColor = categoryData ? getColorHex(categoryData.color) : "#fff";

  const hasIssues = Object.keys(feedback).length > 0; 

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading Journey...</div>;
  if (!story) return null;

  return (
    <ReviewContext.Provider value={{ isAdminView, isAuthorView, feedback, toggleFeedback, isResubmission }}>
    <div className="bg-slate-50 dark:bg-[#0B0F19] min-h-screen pb-20 font-sans transition-colors duration-300">
      <Toaster position="bottom-center" />
      
      {/* ⚡ NEON READING BAR */}
      <motion.div className="fixed top-0 left-0 right-0 h-1.5 z-[100] bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 origin-left" style={{ scaleX }} />

      {/* ⚡ FLOATING NAV CONTROLS */}
      <div className="fixed top-6 left-0 right-0 px-4 md:px-8 z-[90] flex justify-between items-center pointer-events-none">
          <button onClick={() => navigate(-1)} className="pointer-events-auto p-3 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:scale-105 transition-all shadow-lg group"><ArrowLeft size={24}/></button>
          <div className="pointer-events-auto flex gap-3">
            {isAdminView && <div className="px-4 py-2 bg-orange-600 text-white rounded-full font-bold shadow-lg flex items-center gap-2"><ShieldAlert size={16}/> Admin View</div>}
            {isAuthorView && <div className="px-4 py-2 bg-red-600 text-white rounded-full font-bold shadow-lg flex items-center gap-2"><Edit3 size={16}/> Revision Mode</div>}
            <button onClick={() => setIsDark(!isDark)} className="p-3 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:rotate-12 transition-all shadow-lg">{isDark ? <Sun size={24}/> : <Moon size={24} />}</button>
          </div>
      </div>

      {isAuthorView && (
          <div className="fixed top-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
              <motion.div initial={{y:-50, opacity:0}} animate={{y:0, opacity:1}} className="pointer-events-auto bg-red-500/90 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 max-w-lg">
                  <AlertCircle size={24} className="shrink-0"/>
                  <div className="text-sm"><p className="font-bold">Admin Requested Changes</p><p className="opacity-90">Please review flagged sections.</p></div>
              </motion.div>
          </div>
      )}

      {/* --- 🎥 HERO SECTION --- */}
      <div className="relative h-[65vh] lg:h-[95vh] w-full bg-slate-900 overflow-hidden group">
        <ReviewSection id="coverImage" label="Cover Image" className="w-full h-full absolute inset-0" flagPosition="top-24 right-4">
            {story.coverImage ? (<motion.img initial={{ scale: 1.15 }} animate={{ scale: 1 }} src={story.coverImage} className="w-full h-full object-cover" />) : <div className="w-full h-full flex items-center justify-center text-white/20">No Cover</div>}
        </ReviewSection>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-0 z-20 left-0 w-full p-4 md:p-12 lg:p-20 pb-16 lg:pb-40 max-w-7xl mx-auto flex flex-col items-center justify-end h-full text-center pointer-events-none">
            <ReviewSection id="title" label="Title & Meta" className="pointer-events-auto space-y-4 md:space-y-6">
                {/* ⚡ WRAPPED LOCATION IN REVIEW SECTION */}
                <ReviewSection id="location" label="Location" className="inline-block relative" flagPosition="-right-3 -top-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs md:text-sm font-bold uppercase tracking-wider">
                        <MapPin size={12} md:size={14} className="text-orange-400"/> {story.location}
                    </div>
                </ReviewSection>

                <h1 className="text-4xl md:text-7xl lg:text-8xl font-black text-white leading-[1.1] md:leading-[0.9] tracking-tight drop-shadow-2xl">{story.title}</h1>
                
                {/* ⚡ WRAPPED META DETAILS IN REVIEW SECTION */}
                <ReviewSection id="meta" label="Trip Details" className="inline-block relative" flagPosition="-right-4 -top-4">
                    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-white/90 font-medium text-sm md:text-lg pt-2 md:pt-4">
                        <div className="flex items-center gap-2.5"><Calendar size={16} md:size={20} className="text-orange-400"/> {story.month}</div>
                        {categoryData && (<><div className="w-1.5 h-1.5 rounded-full bg-white/30 hidden md:block"/><div className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md" style={{ backgroundColor: `${categoryColor}20` }}>{CategoryIcon && <CategoryIcon size={16} style={{ color: categoryColor }} />}<span style={{ color: categoryColor }} className="font-bold text-sm">{categoryData.label}</span></div></>)}
                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 hidden md:block"/>
                        <div className="flex items-center gap-2.5"><Flag size={16} md:size={20} className="text-emerald-400"/> {tripTypeData ? tripTypeData.label : story.tripType}</div>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 hidden md:block"/>
                        <div className="flex items-center gap-2.5"><Mountain size={16} md:size={20} className="text-rose-400"/> {difficultyData ? difficultyData.label : story.difficulty}</div>
                    </div>
                </ReviewSection>
            </ReviewSection>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10 mt-0 lg:-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-4 space-y-6 md:space-y-8 h-fit lg:sticky lg:top-32 mt-0 lg:mt-32 order-1 lg:order-none">
                <div className="bg-white dark:bg-[#151b2b] p-6 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-6"><div className="w-16 h-16 rounded-full p-1 bg-white dark:bg-[#151b2b] shadow-lg"><img src={authorProfile?.photoURL} className="w-full h-full rounded-full object-cover"/></div><div className="flex-1"><h3 className="text-xl font-black text-slate-900 dark:text-white">{story.authorName}</h3><div className="text-xs text-slate-400 mt-1">{trackersCount} Trackers</div></div></div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div><div className="text-[10px] font-bold text-slate-400 uppercase">Duration</div><div className="text-3xl font-black text-slate-900 dark:text-white">{days.length} Days</div></div>
                        
                        {/* ⚡ WRAPPED COST IN REVIEW SECTION */}
                        <ReviewSection id="cost" label="Cost" className="block relative" flagPosition="right-0 -top-2">
                            <div><div className="text-[10px] font-bold text-slate-400 uppercase">Cost</div><div className="text-3xl font-black text-slate-900 dark:text-white">₹{story.totalCost}</div></div>
                        </ReviewSection>
                    </div>
                    <div className="flex gap-3 md:gap-4">
                        <button onClick={handleLike} className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-sm md:text-base ${hasLiked ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500" : "bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10"}`}><Heart size={18} md:size={20} className={hasLiked ? "fill-current" : ""} /> <span>{hasLiked ? "Liked" : "Like"}</span><span className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full text-xs ml-1 opacity-70">{likeCount}</span></button>
                        <button onClick={handleShare} className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl bg-[#0B0F19] dark:bg-white text-white dark:text-[#0B0F19] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg text-sm md:text-base hover:scale-[1.02]"><Share2 size={18} md:size={20}/> <span>Share</span>{shareCount > 0 && (<span className="bg-white/20 dark:bg-black/10 px-2 py-0.5 rounded-full text-xs ml-1">{shareCount}</span>)}</button>
                    </div>
                </div>
                {(story.aboutPlace || story.specialNote) && (<div className="space-y-4">
                    {story.aboutPlace && (<ReviewSection id="aboutPlace" label="About"><div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-500/10 p-5 rounded-2xl"><div className="flex items-center gap-2 text-orange-700 font-bold mb-2"><Info size={18}/> About</div><p className="text-sm text-slate-700 dark:text-slate-300">{story.aboutPlace}</p></div></ReviewSection>)}
                    {story.specialNote && (<ReviewSection id="specialNote" label="Tips"><div className="bg-pink-50/50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-500/10 p-5 rounded-2xl"><div className="flex items-center gap-2 text-pink-700 font-bold mb-2"><Lightbulb size={18}/> Tips</div><p className="text-sm text-slate-700 dark:text-slate-300">{story.specialNote}</p></div></ReviewSection>)}
                </div>)}
            </div>

            <div className="lg:col-span-8 space-y-12 lg:mt-32 order-2 lg:order-none">
                {days.map((day, i) => (
                    <ReviewSection key={i} id={`day_${day.dayNumber}`} label={`Day ${day.dayNumber}`}>
                    <div className="group relative pl-6 md:pl-8 border-l-2 border-slate-200 dark:border-white/10 last:border-0 pb-12">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-white dark:ring-[#0B0F19]"/>
                        <div className="mb-4 md:mb-6"><span className="text-orange-500 font-bold text-xs md:text-sm tracking-widest uppercase mb-1 md:mb-2 block">Day {day.dayNumber}</span><h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">{day.title}</h2></div>
                        {day.imageUrl && (
                            <div className="w-full aspect-[16/9] rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-8 shadow-2xl relative cursor-zoom-in group/img" onClick={() => { const idx = fullGallery.findIndex(img => img.url === day.imageUrl); if(idx !== -1) setLightboxIndex(idx); }}>
                                <img src={day.imageUrl} alt="Day" className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"/>
                                {day.imageCaption && (<div className="absolute bottom-3 left-4 md:bottom-4 md:left-6 bg-black/60 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full text-white text-[10px] md:text-xs font-medium border border-white/10">{day.imageCaption}</div>)}
                            </div>
                        )}
                        <div className="prose dark:prose-invert max-w-none"><p className="text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{day.story}</p></div>
                        
                        {/* ⚡ RESTORED ITINERARY DETAILS */}
                        {day.highlight && (<div className="mt-6 md:mt-8 p-5 md:p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border-l-4 border-orange-500 italic text-slate-600 dark:text-slate-300 text-sm md:text-base"><span className="block text-orange-500 font-bold text-[10px] md:text-xs uppercase tracking-wider mb-2">Highlight</span>"{day.highlight}"</div>)}
                        {day.food && (<div className="mt-6 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-500/20"><div className="w-12 h-12 rounded-full bg-white dark:bg-emerald-500/20 flex items-center justify-center shadow-sm shrink-0"><Utensils size={20} className="text-emerald-600 dark:text-emerald-400"/></div><div><div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-0.5">On The Menu</div><div className="text-base font-bold text-slate-700 dark:text-slate-200">{day.food}</div></div></div>)}
                        {(day.departure || day.stay) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                {day.departure && (<div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-white/5 shadow-sm"><div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-lg"><Navigation size={18}/></div><div className="text-sm font-medium text-slate-700 dark:text-slate-200"><span className="block text-[10px] text-slate-400 uppercase font-bold">Route</span>{day.departure} → {day.destination}</div></div>)}
                                {day.stay && (<div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-white/5 shadow-sm"><div className="p-2 bg-purple-50 dark:bg-purple-500/10 text-purple-500 rounded-lg"><BedDouble size={18}/></div><div className="text-sm font-medium text-slate-700 dark:text-slate-200"><span className="block text-[10px] text-slate-400 uppercase font-bold">Stay</span>{day.stay}</div></div>)}
                            </div>
                        )}
                    </div>
                    </ReviewSection>
                ))}
            </div>
        </div>

        {/* --- 🛡️ VIDEO SECTION FLAGGING --- */}
        {story.youtubeLink && getYoutubeId(story.youtubeLink) && (
            <ReviewSection id="youtubeLink" label="YouTube Video" className="mt-20 md:mt-24 max-w-5xl mx-auto">
                <div className="flex items-center gap-4 mb-6 md:mb-8 justify-center"><span className="w-12 md:w-16 h-1 bg-red-600 rounded-full"/><h3 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">The Experience</h3><span className="w-12 md:w-16 h-1 bg-red-600 rounded-full"/></div>
                <div className="rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-2xl bg-black aspect-video border-4 border-white dark:border-[#151b2b]"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${getYoutubeId(story.youtubeLink)}`} title="Trip Video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>
            </ReviewSection>
        )}

        {/* --- GALLERY GRID --- */}
        {fullGallery.length > 0 && (
            <ReviewSection id="gallery" label="Photo Gallery" className="mt-24 md:mt-32 max-w-[1400px] mx-auto px-0 md:px-6">
                <div className="flex items-center justify-between mb-8 md:mb-10 px-4 md:px-0"><h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Visual Diary</h3><span className="text-slate-500 font-medium text-sm md:text-base">{fullGallery.length} Photos</span></div>
                <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-6 space-y-3 md:space-y-6">
                    {fullGallery.map((img, idx) => (
                        <motion.div whileHover={{ y: -5 }} key={idx} onClick={() => setLightboxIndex(idx)} className="break-inside-avoid rounded-xl md:rounded-2xl overflow-hidden cursor-zoom-in relative group shadow-lg">
                            <img src={img.url} alt="Gallery" className="w-full h-auto transform transition-transform duration-700 group-hover:scale-105"/>
                            {img.is360 && (<div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm shadow-md z-10"><Globe2 size={12} /> 360° View</div>)}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"/>
                        </motion.div>
                    ))}
                </div>
            </ReviewSection>
        )}

        {/* --- COMMENTS SECTION --- */}
        <div className="mt-24 md:mt-32 max-w-4xl mx-auto px-4 md:px-6 border-t border-slate-200 dark:border-white/10 pt-16">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-8">Discussion ({comments.length})</h3>
            <div className="bg-white dark:bg-[#151b2b] p-3 md:p-2 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-white/5 shadow-lg mb-10 md:mb-12 flex flex-col md:flex-row gap-4 items-start">
                <div className="hidden md:block w-12 h-12 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden shrink-0 ml-2 mt-2">{currentUser?.photoURL ? (<img src={currentUser.photoURL} className="w-full h-full object-cover" alt="Me" />) : (<User className="w-full h-full p-3 text-slate-400"/>)}</div>
                <div className="flex-1 w-full">
                    <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Join the conversation..." className="w-full bg-transparent border-none focus:ring-0 p-2 md:p-4 min-h-[80px] text-slate-900 dark:text-white text-base md:text-lg placeholder:text-slate-400 resize-none"/>
                    <div className="flex justify-between items-center px-2 md:px-4 pb-2"><span className="text-[10px] md:text-xs text-slate-400 font-medium">Markdown supported</span><button onClick={handlePostComment} disabled={submittingComment || !newComment.trim()} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 md:px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 text-sm">{submittingComment ? "Posting..." : <><Send size={14}/> Post</>}</button></div>
                </div>
            </div>
            <div className="space-y-6 md:space-y-8">
                {comments.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10"><MessageSquare size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-500 font-medium">No comments yet. Start the chat!</p></div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 md:gap-4 group">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden shrink-0">{comment.userPhoto ? (<img src={comment.userPhoto} className="w-full h-full object-cover" alt={comment.userName} />) : (<User className="w-full h-full p-2 text-slate-400"/>)}</div>
                            <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-900 dark:text-white text-sm">{comment.userName}</span><span className="text-xs text-slate-400">•</span><span className="text-[10px] md:text-xs text-slate-400">{comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString() : "Just now"}</span></div><p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-[15px]">{comment.text}</p></div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>

      {/* ⚡ PREMIUM GALLERY SLIDER */}
      {lightboxIndex !== -1 && <GallerySlider images={fullGallery} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(-1)} />}

      {/* 🛡️ ADMIN STICKY FOOTER */}
      {isAdminView && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 w-full p-4 z-[100] bg-[#111625]/90 backdrop-blur-xl border-t border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-xl border font-bold flex items-center gap-2 transition-all ${hasIssues ? (isResubmission ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-orange-500/10 border-orange-500/50 text-orange-500 animate-pulse') : 'bg-slate-800 border-white/10 text-slate-400'}`}>
                    {hasIssues ? (isResubmission ? <SearchCheck size={18}/> : <AlertTriangle size={18}/>) : <Check size={18}/>}
                    <span>{hasIssues ? (isResubmission ? "Review Fixes" : "Issues Flagged") : "No Issues Found"}</span>
                </div>
                {hasIssues && <span className="text-xs text-slate-400 hidden md:inline">Authors will see your specific notes for each flag.</span>}
            </div>
            <div className="flex gap-3">
                <button onClick={() => setConfirmAction('return')} disabled={!hasIssues || isSubmittingReview} className="px-6 py-3 rounded-xl font-bold border border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700">Request Changes</button>
                <button onClick={() => setConfirmAction('approve')} disabled={hasIssues || isSubmittingReview} className="px-6 py-3 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg">Approve & Publish</button>
            </div>
        </motion.div>
      )}

      {/* ✍️ AUTHOR STICKY FOOTER (SMART REDIRECT) */}
      {isAuthorView && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 w-full p-4 z-[100] bg-[#111625]/90 backdrop-blur-xl border-t border-white/10 flex justify-end items-center">
              <button onClick={handleEditRedirect} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg flex items-center gap-2"><Hammer size={18}/> Edit & Fix Issues</button>
          </motion.div>
      )}

      {/* 🆕 PREMIUM CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmAction && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                <div className="bg-[#1A1F2E] border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
                    <h3 className="text-2xl font-black text-white mb-2">{confirmAction === 'approve' ? "Publish Story?" : "Return to Author?"}</h3>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 rounded-xl font-bold bg-slate-800 text-slate-300">Cancel</button>
                        <button onClick={confirmAction === 'approve' ? processApprove : processReturn} className="flex-1 py-3 rounded-xl font-bold bg-orange-600 text-white">Yes, Confirm</button>
                    </div>
                </div>
            </div>
        )}
      </AnimatePresence>
    </div>
    </ReviewContext.Provider>
  );
}

// 🛡️ SMART ADMIN COMPONENT: WRAPS CONTENT WITH A FLAG BUTTON
const ReviewSection = ({ id, label, children, className, flagPosition = "-right-3 -top-3" }) => {
    const { isAdminView, isAuthorView, feedback, toggleFeedback, isResubmission } = useContext(ReviewContext);
    const [isOpen, setIsOpen] = useState(false);
    const [comment, setComment] = useState("");
    
    useEffect(() => { 
        if(feedback[id]) setComment(feedback[id]); 
        // ⚡ REMOVED AUTO-OPEN FOR AUTHOR (Collapsed by default)
    }, [feedback, id]);

    const hasIssue = !!feedback[id];
    const shouldShowFlag = isAdminView || (isAuthorView && hasIssue);

    if (!shouldShowFlag) return <div className={className}>{children}</div>;

    // ⚡ DETERMINE FLAG STYLE (Red for new error, Blue for "Verify This Fix")
    const flagColor = isResubmission && hasIssue ? "bg-blue-600 hover:bg-blue-500" : "bg-red-600 hover:bg-red-500";
    const flagIcon = isResubmission && hasIssue ? <SearchCheck size={16} className="text-white"/> : <Flag size={16} className="text-white" fill="currentColor"/>;

    return (
        <div className={`group/admin relative ${className} ${hasIssue ? (isResubmission ? 'ring-2 ring-blue-500/50 rounded-xl bg-blue-500/5' : 'ring-2 ring-red-500/50 rounded-xl bg-red-500/5') : ''}`}>
            {children}
            
            {/* ⚡ FLAG BUTTON OR BADGE */}
            {isAdminView ? (
                // ADMIN VIEW: FLAGGING BUTTON
                <button 
                    onClick={() => setIsOpen(!isOpen)} 
                    className={`absolute ${flagPosition} z-50 p-2 rounded-full shadow-xl transition-all transform hover:scale-110 
                    ${hasIssue ? flagColor : 'bg-white text-slate-400 border border-slate-200'}`} 
                    title={isResubmission ? "Verify Author's Fix" : "Flag Issue"}
                >
                    {hasIssue ? flagIcon : <Flag size={16}/>}
                </button>
            ) : (
                // AUTHOR VIEW: UPDATED BADGE (Collapsed, Click to View)
                <button 
                    onClick={() => setIsOpen(!isOpen)} 
                    className={`absolute ${flagPosition} z-50 px-4 py-2 rounded-full shadow-xl bg-red-600 text-white text-xs font-bold flex items-center gap-2 animate-bounce cursor-pointer hover:bg-red-700 transition-colors`} 
                >
                    <AlertTriangle size={14} fill="currentColor"/>
                    <span>Action Required (Click to View)</span>
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="absolute right-0 top-8 z-50 w-72 bg-[#1A1F2E] border border-white/10 rounded-xl shadow-2xl p-4">
                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-slate-400 uppercase">{isResubmission ? "Verify Modification" : `Issue with ${label}`}</span><button onClick={() => setIsOpen(false)}><X size={14} className="text-slate-500"/></button></div>
                        <textarea 
                            className={`w-full h-24 bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-red-500 resize-none mb-3 ${!isAdminView ? 'cursor-not-allowed opacity-80' : ''}`} 
                            placeholder="Describe the issue..." 
                            value={comment} 
                            onChange={(e) => setComment(e.target.value)} 
                            autoFocus={isAdminView}
                            readOnly={!isAdminView} 
                        />
                        <div className="flex gap-2">
                            {isAdminView ? (
                                <>
                                    {hasIssue && (<button onClick={() => { toggleFeedback(id, null); setComment(""); setIsOpen(false); }} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-500 flex items-center justify-center gap-1"><Check size={12}/> Resolve</button>)}
                                    <button onClick={() => { if(!comment.trim()) return toast.error("Write comment"); toggleFeedback(id, comment); setIsOpen(false); toast.success("Flagged!"); }} className={`flex-1 py-2 rounded-lg text-white text-xs font-bold ${isResubmission ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}>{hasIssue ? "Update Note" : "Flag Issue"}</button>
                                </>
                            ) : (
                                <button onClick={() => setIsOpen(false)} className="w-full py-2 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-600">Close</button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};