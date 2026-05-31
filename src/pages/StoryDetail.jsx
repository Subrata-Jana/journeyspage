import React, { useEffect, useState, useContext, createContext, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
    collection, doc, getDoc, getDocs, orderBy, query, onSnapshot, addDoc, serverTimestamp
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import {
    MapPin, Calendar, Flag, Mountain, Info, Lightbulb, User,
    Utensils, BedDouble, Navigation,
    ShieldAlert, Share2, Heart, Send,
    ArrowLeft, Sun, Moon, Footprints, Check, Globe2, AlertTriangle, Edit3, Hammer, SearchCheck, Gift, X
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useMetaOptions } from "../hooks/useMetaOptions";
import GallerySlider from "../components/GallerySlider";
import ThreeSixtyViewer from "../components/ThreeSixtyViewer";
import { recordStoryView, toggleStoryLike, toggleUserTrack, trackShare } from "../services/gamificationService";
import { sendNotification } from "../services/notificationService";
import { approveStoryReview, rejectStoryReview, returnStoryForRevision } from "../services/reviewService";
import TreasureSpawner from "../components/premium/TreasureSpawner";
import GiftModal from "../components/gamification/GiftModal";
import SmartImage from "../components/ui/SmartImage";
import { canReviewStoryAsStaff } from "../utils/admin";
import { goBackOrFallback } from "../utils/navigation";
import { getProfilePhotoUrl } from "../utils/userProfile";

// --- CONTEXT FOR SMART REVIEW ---
const ReviewContext = createContext();

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

const hasBengaliText = (value = "") => /[\u0980-\u09FF]/.test(value);

export default function StoryDetail() {
    const { userProfile } = useAuth();
    const { storyId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const auth = getAuth();

    // ⚡ REACTIVE USER STATE
    const [currentUser, setCurrentUser] = useState(auth.currentUser);
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsub();
    }, []);

    const { options: categories } = useMetaOptions("categories");
    const { options: tripTypes } = useMetaOptions("tripTypes");
    const { options: difficulties } = useMetaOptions("difficultyLevels");

    const [story, setStory] = useState(null);
    const [authorProfile, setAuthorProfile] = useState(null);
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);

    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [submittingComment, setSubmittingComment] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [trackersCount, setTrackersCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [shareCount, setShareCount] = useState(0);

    const [showGiftModal, setShowGiftModal] = useState(false);
    const [fullGallery, setFullGallery] = useState([]);
    const [lightboxIndex, setLightboxIndex] = useState(-1);

    // ⚡ ADMIN LOGIC CHECK
    const [feedback, setFeedback] = useState({});
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [isAuthorView, setIsAuthorView] = useState(false);

    // --- ANALYTICS ---
    const [minTimePassed, setMinTimePassed] = useState(false);
    const [hasScrolled, setHasScrolled] = useState(false);
    const viewTriggered = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => { setMinTimePassed(true); }, 5000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const handleScroll = () => { if (!hasScrolled && window.scrollY > 150) setHasScrolled(true); };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [hasScrolled]);

    useEffect(() => {
        if (!storyId || viewTriggered.current || !story) return;
        if (minTimePassed && hasScrolled && story.status === 'approved') {
            const sessionKey = `viewed_${storyId}`;
            if (sessionStorage.getItem(sessionKey)) return;
            viewTriggered.current = true;
            sessionStorage.setItem(sessionKey, "true");
            recordStoryView(storyId);
        }
    }, [minTimePassed, hasScrolled, storyId, story]);

    // --- THEME ---
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

    const isResubmission = story?.status === 'pending' && story?.feedback && Object.keys(story.feedback).length > 0;
    const isAdminView = canReviewStoryAsStaff(currentUser, userProfile, story);
    const isBengaliTitle = hasBengaliText(story?.title);

    useEffect(() => {
        if (!storyId) return;
        async function fetchStoryAndAuthor() {
            try {
                const storyRef = doc(db, "stories", storyId);
                const storySnap = await getDoc(storyRef);
                if (!storySnap.exists()) { navigate("/dashboard", { replace: true }); return; }
                const storyData = storySnap.data();

                const isAuthor = currentUser?.uid === storyData.authorId;
                const isReturned = storyData.status === 'returned';
                const isPending = storyData.status === 'pending';
                setIsAuthorView(isAuthor && isReturned);

                if (storyData.feedback) {
                    const cleanFeedback = {};
                    Object.entries(storyData.feedback).forEach(([k, v]) => { if (v && v.trim() !== "") cleanFeedback[k] = v; });
                    setFeedback(cleanFeedback);
                }

                const canModerateStory = canReviewStoryAsStaff(currentUser, userProfile, storyData);

                if (
                    !storyData.published &&
                    !canModerateStory &&
                    !(isAuthor && (isReturned || isPending || storyData.status === 'rejected'))
                ) {
                    navigate("/dashboard", { replace: true });
                    return;
                }

                setLikeCount(storyData.likeCount || (storyData.likes ? storyData.likes.length : 0));
                setShareCount(storyData.shareCount || 0);
                if (currentUser && storyData.likes && storyData.likes.includes(currentUser.uid)) setHasLiked(true);
                setStory({ id: storySnap.id, ...storyData });
                setLoading(false);

                const daysRef = collection(db, "stories", storyId, "days");
                const daysQuery = query(daysRef, orderBy("dayNumber", "asc"));

                const [authorResult, daysResult] = await Promise.allSettled([
                    storyData.authorId ? getDoc(doc(db, "users", storyData.authorId)) : Promise.resolve(null),
                    getDocs(daysQuery),
                ]);

                if (authorResult.status === "fulfilled" && authorResult.value?.exists?.()) {
                    const userData = authorResult.value.data();
                    setAuthorProfile(userData);
                    const realCount = userData.trackers ? userData.trackers.length : (userData.trackersCount || 0);
                    setTrackersCount(realCount);
                    if (currentUser && userData.trackers && userData.trackers.includes(currentUser.uid)) setIsTracking(true);
                }

                if (daysResult.status === "fulfilled") {
                    const daysData = daysResult.value.docs.map(d => d.data());
                    setDays(daysData);

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
                }
            } catch (err) { console.error("Error:", err); navigate("/dashboard", { replace: true }); } finally { setLoading(false); }
        }
        fetchStoryAndAuthor();
    }, [storyId, navigate, currentUser, userProfile]);

    useEffect(() => {
        if (!storyId) return;
        const commentsRef = collection(db, "stories", storyId, "comments");
        const q = query(commentsRef, orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => { setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        return () => unsubscribe();
    }, [storyId]);

    // --- ACTIONS ---

    const handleTrack = async () => {
        if (!currentUser) return toast.error("Please login to track scouts");
        if (currentUser.uid === story.authorId) return toast.error("You cannot track yourself!");

        const previousTracking = isTracking;
        const previousCount = trackersCount;
        setIsTracking(!isTracking);
        setTrackersCount(prev => isTracking ? prev - 1 : prev + 1);

        const result = await toggleUserTrack(story.authorId);
        if (!result.success) {
            setIsTracking(previousTracking);
            setTrackersCount(previousCount);
            toast.error("Action failed");
        } else if (!previousTracking) {
            toast.success(`Tracking ${story.authorName}! (+${result.xpGained || 0} XP)`);
        }
    };

    const handleLike = async () => {
        if (!currentUser) return toast.error("Please login to like stories");
        if (currentUser.uid === story.authorId) return toast.error("You cannot like your own story");
        if (hasLiked) return;
        if (isLiking) return;

        setIsLiking(true);
        setHasLiked(true);
        setLikeCount(prev => prev + 1);

        try {
            const result = await toggleStoryLike(story.id);
            if (result.success) {
                toast.success(`Liked! (+${result.xpGained || 0} XP)`);
            } else {
                setHasLiked(false);
                setLikeCount(prev => prev - 1);
                toast.error("Action failed");
            }
        } catch (error) {
            setHasLiked(false);
            setLikeCount(prev => prev - 1);
        } finally {
            setIsLiking(false);
        }
    };

    const handleGift = () => {
        if (!currentUser) return toast.error("Log in to send a Tribute!");
        if (currentUser.uid === story.authorId) return toast.error("You cannot gift yourself!");
        setShowGiftModal(true);
    };

    const handleShare = async () => {
        const shareData = { title: story.title, text: `Check out this journey: ${story.title} by ${story.authorName}`, url: window.location.href };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                if (currentUser) {
                    const result = await trackShare(story.id);
                    if (result.success && result.shared) {
                        toast.success(`Thanks for sharing! (+${result.xpGained || 0} XP)`);
                        setShareCount(prev => prev + 1);
                    }
                }
            } catch (err) { console.log("Share canceled"); }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
                if (currentUser) {
                    const result = await trackShare(story.id);
                    if (result.success && result.shared) {
                        setShareCount(prev => prev + 1);
                    }
                }
            } catch (err) { toast.error("Failed to copy link"); }
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
                userName: currentUser.displayName || "Anonymous",
                userPhoto: currentUser.photoURL || "",
                createdAt: serverTimestamp()
            });
            if (currentUser.uid !== story.authorId) {
                await sendNotification({
                    recipientId: story.authorId,
                    type: 'comment',
                    title: 'New Comment',
                    message: `${currentUser.displayName || "Someone"} commented on "${story.title}"`,
                    link: `/story/${story.id}`,
                    actorId: currentUser.uid,
                    actorName: currentUser.displayName || "Someone",
                    entityType: "story",
                    entityId: story.id,
                    channel: "social",
                });
            }
            setNewComment("");
            toast.success("Comment posted!");
        } catch (e) { toast.error("Failed to post comment"); } finally { setSubmittingComment(false); }
    };

    // --- REVIEW SYSTEM ---
    const toggleFeedback = useCallback((fieldId, comment) => {
        if (!isAdminView) return;
        setFeedback(prev => {
            const next = { ...prev };
            if (!comment || comment.trim() === "") {
                delete next[fieldId];
            } else {
                next[fieldId] = comment;
            }
            return next;
        });
    }, [isAdminView]);

    const processApprove = async () => {
        if (!canReviewStoryAsStaff(currentUser, userProfile, story)) {
            return toast.error("You cannot review your own story.");
        }
        setIsSubmittingReview(true);
        try {
            await approveStoryReview({
                storyId,
                authorId: story.authorId,
                title: story.title,
                reviewerId: currentUser?.uid || "",
                reviewerName: userProfile?.name || currentUser?.displayName || currentUser?.email || "Reviewer",
            });
            toast.success("Story Published Successfully!");
            navigate("/admin");
        } catch (error) {
            toast.error("Failed to approve");
        } finally { setIsSubmittingReview(false); }
    };

    const processReturn = async () => {
        if (!canReviewStoryAsStaff(currentUser, userProfile, story)) {
            return toast.error("You cannot review your own story.");
        }
        setIsSubmittingReview(true);
        try {
            await returnStoryForRevision({
                storyId,
                authorId: story.authorId,
                title: story.title,
                existingFeedback: feedback,
                generalNote: feedback.general || "",
                reviewerId: currentUser?.uid || "",
                reviewerName: userProfile?.name || currentUser?.displayName || currentUser?.email || "Reviewer",
            });
            toast.success("Story returned to author");
            navigate("/admin");
        } catch (error) {
            toast.error("Failed to return story");
        } finally { setIsSubmittingReview(false); }
    };

    const processReject = async () => {
        if (!canReviewStoryAsStaff(currentUser, userProfile, story)) {
            return toast.error("You cannot review your own story.");
        }
        const reason = feedback.general || "This story does not meet the publishing guidelines.";
        setIsSubmittingReview(true);
        try {
            await rejectStoryReview({
                storyId,
                authorId: story.authorId,
                title: story.title,
                reason,
                reviewerId: currentUser?.uid || "",
                reviewerName: userProfile?.name || currentUser?.displayName || currentUser?.email || "Reviewer",
            });
            toast.success("Story rejected");
            navigate("/admin");
        } catch (error) {
            toast.error("Failed to reject story");
        } finally { setIsSubmittingReview(false); }
    };

    const handleEditRedirect = () => { navigate(`/create-story?edit=${storyId}`); };
    const getYoutubeId = (url) => { if (!url) return null; const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : null; };

    const categoryData = story?.category ? categories.find(c => c.value === story.category || c.label === story.category) : null;
    const tripTypeData = story?.tripType ? tripTypes.find(t => t.value === story.tripType || t.label === story.tripType) : null;
    const difficultyData = story?.difficulty ? difficulties.find(d => d.value === story.difficulty || d.label === story.difficulty) : null;
    const CategoryIcon = categoryData && LucideIcons[categoryData.icon] ? LucideIcons[categoryData.icon] : null;
    const categoryColor = categoryData ? getColorHex(categoryData.color) : "#fff";
    const tripDurationDays = story?.tripDurationDays || story?.durationDays || days.length || 1;
    const budgetValue = Number(story?.totalCost || 0);
    const budgetText = Number.isFinite(budgetValue) && budgetValue > 0
        ? `INR ${budgetValue.toLocaleString()}`
        : "Not listed";
    const budgetBasisLabel = story?.budgetBasis === "per_person" ? "Per person" : "Whole trip";

    const issuesCount = Object.entries(feedback || {}).filter(
        ([key, val]) => key !== "general" && val && val.trim() !== ""
    ).length;

    const hasIssues = issuesCount > 0;
    const hasGeneralFeedback = feedback.general && feedback.general.trim() !== "";

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading Journey...</div>;
    if (!story) return null;

    return (
        <ReviewContext.Provider value={{ isAdminView, isAuthorView, feedback, toggleFeedback, isResubmission }}>
            <div className="bg-slate-50 dark:bg-[#0B0F19] min-h-screen pb-32 font-sans transition-colors duration-300 relative overflow-x-hidden">
                <Toaster position="bottom-center" />

                {currentUser && currentUser.uid !== story.authorId && !isAdminView && <TreasureSpawner storyId={story.id} />}

                {/* ⚡ DEBUG: ADMIN BADGE */}
                {isAdminView && (
                    <div className="fixed top-20 left-4 z-[50] bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none opacity-50">
                        ADMIN MODE ACTIVE
                    </div>
                )}

                <motion.div className="fixed top-0 left-0 right-0 h-1.5 z-[50] bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 origin-left" style={{ scaleX }} />

                {/* HEADER */}
                <div className="fixed top-6 left-0 right-0 px-4 md:px-8 z-[90] flex justify-between items-center pointer-events-none w-full max-w-[100vw] overflow-x-hidden">
                    <button onClick={() => goBackOrFallback(navigate, "/dashboard", location.state?.from)} className="pointer-events-auto p-3 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:bg-black/40 hover:scale-105 transition-all shadow-lg group">
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="pointer-events-auto flex gap-2 md:gap-3">
                        {isAdminView && <div className="hidden md:flex px-4 py-2 bg-orange-600 text-white rounded-full font-bold shadow-lg items-center gap-2"><ShieldAlert size={16} /> Reviewer</div>}
                        {isAuthorView && <div className="hidden md:flex px-4 py-2 bg-red-600 text-white rounded-full font-bold shadow-lg items-center gap-2"><Edit3 size={16} /> Revision</div>}
                        <button onClick={() => setIsDark(!isDark)} className="p-3 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:rotate-12 transition-all shadow-lg">
                            {isDark ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} />}
                        </button>
                    </div>
                </div>

                {/* ALERTS */}
                {isAuthorView && (
                    <div className="max-w-7xl mx-auto px-4 mt-24 mb-4">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0"><AlertTriangle size={24} className="text-red-500" /></div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Admin Requested Changes</h3>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Please review the flagged sections below.</p>
                            </div>
                            <button onClick={handleEditRedirect} className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-500 transition-all flex items-center gap-2"><Hammer size={16} /> Fix Now</button>
                        </div>
                    </div>
                )}

                {hasGeneralFeedback && (
                    <div className="max-w-7xl mx-auto px-4 mt-24 md:mt-28 mb-4">
                        <ReviewSection id="general" label="General Feedback" className="w-full">
                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 flex items-start gap-4 shadow-lg">
                                <div className="p-2 bg-orange-500/20 rounded-lg text-orange-500 shrink-0"><Info size={20} /></div>
                                <div><h4 className="font-bold text-orange-500 uppercase tracking-wider text-xs mb-1">General Feedback</h4><p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{feedback.general}</p></div>
                            </div>
                        </ReviewSection>
                    </div>
                )}

                {/* HERO SECTION */}
                <div className="relative h-[85vh] md:h-[95vh] w-full bg-slate-900 overflow-hidden group">

                    {/* 1. VISUAL LAYER (Image) */}
                    <div className="absolute inset-0 z-0 pointer-events-none">
                        {story.coverImage ? (
                            <motion.div initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} className="w-full h-full">
                                <SmartImage
                                    src={story.coverImage}
                                    alt={story.title}
                                    className="w-full h-full"
                                    imgClassName="w-full h-full object-cover"
                                    variant="hero"
                                    loading="eager"
                                    fetchPriority="high"
                                />
                            </motion.div>
                        ) : <div className="w-full h-full flex items-center justify-center text-white/20">No Cover</div>}
                    </div>

                    {/* 2. ADMIN INTERACTION LAYER (Flag) */}
                    <div className="absolute top-0 left-0 right-0 h-1/2 z-40">
                        <ReviewSection
                            id="coverImage"
                            label="Cover Image"
                            className="w-full h-full"
                            flagPosition="top-24 right-4"
                        >
                            <div className="w-full h-full" />
                        </ReviewSection>
                    </div>

                    {/* 3. READABILITY OVERLAYS */}
                    <div className="absolute inset-0 bg-black/10 pointer-events-none z-10" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(11,15,25,0.2)_0%,_rgba(11,15,25,0.14)_38%,_transparent_64%)] pointer-events-none z-10" />
                    <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/35 to-transparent pointer-events-none z-10" />
                    <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(to_top,_rgba(11,15,25,0.94),_rgba(11,15,25,0.52)_42%,_rgba(11,15,25,0.12)_74%,_transparent)] pointer-events-none z-10" />

                    {/* 4. CONTENT (Z-50) */}
                    <div className="absolute bottom-0 inset-0 z-20 left-0 w-full p-4 md:p-12 lg:p-20 pb-10 md:pb-14 lg:pb-24 max-w-7xl mx-auto flex flex-col items-center justify-end h-full text-center pointer-events-none">
                        <ReviewSection id="title" label="Title & Meta" className="pointer-events-auto relative space-y-3 md:space-y-4 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000">

                            {/* ⚡ UPDATED: Responsive flagPosition for Location */}
                            <ReviewSection id="location" label="Location" className="inline-block relative" flagPosition="right-0 -top-2 md:-right-3 md:-top-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white text-xs md:text-sm font-bold uppercase tracking-wider shadow-xl">
                                    <MapPin size={12} md:size={14} className="text-orange-400" /> {story.location}
                                </div>
                            </ReviewSection>

                            <h1 className={`mx-auto max-w-6xl text-3xl md:text-6xl lg:text-8xl font-black text-white leading-[1.1] md:leading-[0.98] tracking-tight break-words [text-shadow:_0_10px_32px_rgb(0_0_0_/_76%),_0_2px_6px_rgb(0_0_0_/_90%)] ${isBengaliTitle ? "font-bengali-title story-title-bengali" : ""}`}>
                                {story.title}
                            </h1>

                            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 text-white/95 font-medium text-xs md:text-base pt-1 md:pt-2 [text-shadow:_0_2px_8px_rgb(0_0_0_/_70%)]">
                                <ReviewSection id="month" label="Month" className="inline-block relative">
                                    <div className="flex items-center gap-1.5 md:gap-2 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur-md border border-white/10"><Calendar size={14} md:size={18} className="text-orange-400" /> {story.month}</div>
                                </ReviewSection>

                                {categoryData && (
                                    <ReviewSection id="category" label="Category" className="inline-block relative">
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md" style={{ backgroundColor: `${categoryColor}30` }}>
                                            {CategoryIcon && <CategoryIcon size={14} style={{ color: categoryColor }} />}
                                            <span style={{ color: categoryColor }} className="font-bold text-xs md:text-sm">{categoryData.label}</span>
                                        </div>
                                    </ReviewSection>
                                )}

                                <ReviewSection id="tripType" label="Trip Type" className="inline-block relative">
                                    <div className="flex items-center gap-1.5 md:gap-2 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur-md border border-white/10"><Flag size={14} md:size={18} className="text-emerald-400" /> {tripTypeData ? tripTypeData.label : story.tripType}</div>
                                </ReviewSection>

                                <ReviewSection id="difficulty" label="Difficulty" className="inline-block relative">
                                    <div className="flex items-center gap-1.5 md:gap-2 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur-md border border-white/10"><Mountain size={14} md:size={18} className="text-rose-400" /> {difficultyData ? difficultyData.label : story.difficulty}</div>
                                </ReviewSection>
                            </div>
                        </ReviewSection>
                    </div>
                </div>

                {/* --- CONTENT GRID --- */}
                <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10 mt-0 lg:-mt-24">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

                        {/* AUTHOR CARD */}
                        <div className="lg:col-span-4 space-y-6 md:space-y-8 h-fit lg:sticky lg:top-32 mt-6 lg:mt-32 order-1 lg:order-none">
                            <div className="bg-white dark:bg-[#151b2b] p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-white/5 relative transition-colors duration-300">
                                <div className="flex items-center gap-3 md:gap-5 mb-6 md:mb-8">
                                    <div className="relative shrink-0"><div className="w-14 h-14 md:w-20 md:h-20 rounded-full p-1 bg-white dark:bg-[#151b2b] shadow-lg"><img src={getProfilePhotoUrl(authorProfile) || `https://ui-avatars.com/api/?name=${story.authorName}`} className="w-full h-full rounded-full object-cover" alt="Author" /></div></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start flex-wrap gap-2">
                                            <div><div className="text-[10px] md:text-xs font-bold text-orange-500 tracking-widest uppercase mb-1">{authorProfile?.currentRank?.name || authorProfile?.badge || "SCOUT"}</div><h3 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white leading-none truncate pr-2 max-w-[150px] md:max-w-none">{story.authorName}</h3></div>
                                            {currentUser && currentUser.uid !== story.authorId && (
                                                <button onClick={handleTrack} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 ${isTracking ? "bg-transparent border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400" : "bg-orange-500 border-orange-500 text-white hover:bg-orange-600 shadow-md hover:shadow-lg"}`}>{isTracking ? <>Tracking <Check size={12} /></> : <><Footprints size={12} /> Track +</>}</button>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${trackersCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />{trackersCount} Trackers</div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100 dark:bg-white/5 w-full mb-6 md:mb-8" />
                                <div className="grid grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
                                    <ReviewSection id="duration" label="Trip Duration" className="block relative">
                                        <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Trip Duration</div><div className="flex items-baseline gap-1"><span className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white">{tripDurationDays}</span><span className="text-xs md:text-sm font-bold text-slate-400">Days</span></div><div className="mt-1 text-[10px] font-medium text-slate-400">{days.length} itinerary {days.length === 1 ? "entry" : "entries"}</div></div>
                                    </ReviewSection>

                                    {/* ⚡ UPDATED: Responsive flagPosition for Cost */}
                                    <ReviewSection id="cost" label="Cost" className="block relative" flagPosition="right-0 -top-2 md:-right-3 md:-top-2">
                                        <div><div className="text-[10px] font-bold text-slate-400 uppercase">Estimated Budget</div><div className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{budgetText}</div><div className="mt-1 text-[10px] font-medium text-slate-400">{budgetBasisLabel}</div></div>
                                    </ReviewSection>
                                </div>

                                {/* 🎁 ACTION BUTTONS */}
                                <div className="flex gap-2 md:gap-3">
                                    <button onClick={handleLike} disabled={hasLiked || isLiking} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs md:text-sm shadow-sm border ${hasLiked ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border-red-200 dark:border-red-500/20 cursor-default" : "bg-white dark:bg-white/5 text-slate-600 dark:text-white border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 hover:scale-[1.02]"}`}>
                                        <Heart size={16} className={`transition-all duration-300 ${hasLiked ? "fill-current scale-110" : ""}`} /> <span>{hasLiked ? "Liked" : "Like"}</span>
                                    </button>
                                    {currentUser && currentUser.uid !== story.authorId && (
                                        <button onClick={handleGift} className="flex-1 py-3 rounded-xl bg-gradient-to-tr from-yellow-500 to-orange-500 text-white font-bold flex items-center justify-center gap-2 text-xs md:text-sm shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-transform"><Gift size={16} /> Gift</button>
                                    )}
                                    <button onClick={handleShare} className="flex-1 py-3 rounded-xl bg-[#0B0F19] dark:bg-white text-white dark:text-[#0B0F19] font-bold flex items-center justify-center gap-2 text-xs md:text-sm"><Share2 size={16} /> Share</button>
                                </div>
                            </div>
                            {(story.aboutPlace || story.specialNote) && (<div className="space-y-4">
                                {story.aboutPlace && (<ReviewSection id="aboutPlace" label="About"><div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-500/10 p-5 rounded-2xl"><div className="flex items-center gap-2 text-orange-700 font-bold mb-2"><Info size={18} /> About</div><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{story.aboutPlace}</p></div></ReviewSection>)}
                                {story.specialNote && (<ReviewSection id="specialNote" label="Tips"><div className="bg-pink-50/50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-500/10 p-5 rounded-2xl"><div className="flex items-center gap-2 text-pink-700 font-bold mb-2"><Lightbulb size={18} /> Tips</div><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{story.specialNote}</p></div></ReviewSection>)}
                            </div>)}
                        </div>

                        {/* ITINERARY LIST */}
                        <div className="lg:col-span-8 space-y-8 md:space-y-12 lg:mt-32 order-2 lg:order-none">
                            {days.map((day, i) => (
                                <ReviewSection key={i} id={`day_${day.dayNumber}`} label={`Day ${day.dayNumber}`}>
                                    <div className="group relative pl-4 md:pl-8 border-l-2 border-slate-200 dark:border-white/10 last:border-0 pb-12">
                                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-white dark:ring-[#0B0F19]" />
                                        <div className="mb-4 md:mb-6"><span className="text-orange-500 font-bold text-xs md:text-sm tracking-widest uppercase mb-1 md:mb-2 block">Day {day.dayNumber}</span><h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight break-words">{day.title}</h2></div>
                                        {day.imageUrl && (
                                            <div className="w-full aspect-[16/9] rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-8 shadow-xl relative cursor-zoom-in group/img" onClick={() => { const idx = fullGallery.findIndex(img => img.url === day.imageUrl); if (idx !== -1) setLightboxIndex(idx); }}>
                                                <SmartImage
                                                    src={day.imageUrl}
                                                    alt={`Day ${day.dayNumber}`}
                                                    className="w-full h-full"
                                                    imgClassName="w-full h-full object-cover group-hover/img:scale-105"
                                                />
                                                {day.imageCaption && (<div className="absolute bottom-3 left-4 md:bottom-4 md:left-6 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] md:text-xs font-medium border border-white/10 max-w-[80%] truncate">{day.imageCaption}</div>)}
                                            </div>
                                        )}
                                        <div className="prose dark:prose-invert max-w-full"><p className="text-sm md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words">{day.story}</p></div>
                                        {day.highlight && (<div className="mt-6 p-4 md:p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border-l-4 border-orange-500 italic text-slate-600 dark:text-slate-300 text-sm md:text-base break-words"><span className="block text-orange-500 font-bold text-[10px] md:text-xs uppercase tracking-wider mb-2">Highlight</span>"{day.highlight}"</div>)}
                                        {day.food && (<div className="mt-6 flex items-center gap-3 md:gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-500/20"><div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white dark:bg-emerald-500/20 flex items-center justify-center shadow-sm shrink-0"><Utensils size={18} className="text-emerald-600 dark:text-emerald-400" /></div><div><div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-0.5">On The Menu</div><div className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-200">{day.food}</div></div></div>)}
                                        {(day.departure || day.stay) && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                                {day.departure && (<div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-white/5 shadow-sm"><div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-lg"><Navigation size={18} /></div><div className="text-sm font-medium text-slate-700 dark:text-slate-200"><span className="block text-[10px] text-slate-400 uppercase font-bold">Route</span>{day.departure} → {day.destination}</div></div>)}
                                                {day.stay && (<div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-white/5 shadow-sm"><div className="p-2 bg-purple-50 dark:bg-purple-500/10 text-purple-500 rounded-lg"><BedDouble size={18} /></div><div className="text-sm font-medium text-slate-700 dark:text-slate-200"><span className="block text-[10px] text-slate-400 uppercase font-bold">Stay</span>{day.stay}</div></div>)}
                                            </div>
                                        )}
                                    </div>
                                </ReviewSection>
                            ))}
                        </div>
                    </div>

                    {/* YOUTUBE VIDEO */}
                    {story.youtubeLink && getYoutubeId(story.youtubeLink) && (
                        <ReviewSection id="youtubeLink" label="YouTube Video" className="mt-20 md:mt-24 max-w-5xl mx-auto w-full">
                            <div className="flex items-center gap-4 mb-6 md:mb-8 justify-center"><span className="w-8 md:w-16 h-1 bg-red-600 rounded-full" /><h3 className="text-xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">The Experience</h3><span className="w-8 md:w-16 h-1 bg-red-600 rounded-full" /></div>
                            <div className="rounded-xl md:rounded-[2.5rem] overflow-hidden shadow-2xl bg-black aspect-video w-full border-4 border-white dark:border-[#151b2b]">
                                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${getYoutubeId(story.youtubeLink)}`} title="Trip Video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                            </div>
                        </ReviewSection>
                    )}

                    {/* GALLERY */}
                    {fullGallery.length > 0 && (
                        <ReviewSection id="gallery" label="Photo Gallery" className="mt-24 md:mt-32 max-w-[1400px] mx-auto px-4 md:px-6">
                            <div className="flex items-center justify-between mb-6"><h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Visual Diary</h3><span className="text-slate-500 font-medium text-xs md:text-base">{fullGallery.length} Photos</span></div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {fullGallery.map((img, idx) => (
                                    <motion.div
                                        whileHover={{ y: -5, scale: 1.02 }}
                                        key={idx}
                                        onClick={() => setLightboxIndex(idx)}
                                        className="relative aspect-square rounded-xl overflow-hidden cursor-zoom-in shadow-lg group border border-slate-200 dark:border-white/10"
                                    >
                                        <SmartImage
                                            src={img.url}
                                            alt={img.caption || "Gallery"}
                                            className="w-full h-full"
                                            imgClassName="w-full h-full object-cover group-hover:scale-110"
                                        />

                                        {/* 360 Badge */}
                                        {img.is360 && (
                                            <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm z-10 shadow-lg">
                                                <Globe2 size={12} className="animate-pulse" /> 360°
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </motion.div>
                                ))}
                            </div>
                        </ReviewSection>
                    )}

                    {/* COMMENTS SECTION */}
                    <div className="mt-24 md:mt-32 max-w-4xl mx-auto px-4 md:px-6 border-t border-slate-200 dark:border-white/10 pt-16">
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-8">Discussion ({comments.length})</h3>
                        <div className="bg-white dark:bg-[#151b2b] p-3 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-white/5 shadow-lg mb-10 md:mb-12 flex flex-col md:flex-row gap-4 items-start">
                            <div className="hidden md:block w-12 h-12 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden shrink-0 ml-2 mt-2">{currentUser?.photoURL ? (<img src={currentUser.photoURL} className="w-full h-full object-cover" alt="Me" />) : (<User className="w-full h-full p-3 text-slate-400" />)}</div>
                            <div className="flex-1 w-full">
                                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Join the conversation..." className="w-full bg-transparent border-none focus:ring-0 p-2 min-h-[80px] text-slate-900 dark:text-white text-base md:text-lg placeholder:text-slate-400 resize-none" />
                                <div className="flex justify-between items-center px-2 pb-2"><span className="text-[10px] md:text-xs text-slate-400 font-medium">Markdown supported</span><button onClick={handlePostComment} disabled={submittingComment || !newComment.trim()} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 text-xs md:text-sm">{submittingComment ? "Posting..." : <><Send size={14} /> Post</>}</button></div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-3 md:gap-4 group">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden shrink-0">{comment.userPhoto ? (<img src={comment.userPhoto} className="w-full h-full object-cover" alt={comment.userName} />) : (<User className="w-full h-full p-2 text-slate-400" />)}</div>
                                    <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-900 dark:text-white text-sm">{comment.userName}</span><span className="text-xs text-slate-400">•</span><span className="text-[10px] md:text-xs text-slate-400">{comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString() : "Just now"}</span></div><p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-[15px]">{comment.text}</p></div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* LIGHTBOX */}
                {lightboxIndex !== -1 && (
                    fullGallery[lightboxIndex]?.is360 ? (
                        <div className="fixed inset-0 z-[100] bg-black w-full h-full">
                            <ThreeSixtyViewer
                                imageUrl={fullGallery[lightboxIndex].url}
                                onClose={() => setLightboxIndex(-1)}
                            />
                        </div>
                    ) : (
                        <GallerySlider
                            images={fullGallery}
                            initialIndex={lightboxIndex}
                            onClose={() => setLightboxIndex(-1)}
                        />
                    )
                )}

                {/* GIFT MODAL */}
                <AnimatePresence>
                    {showGiftModal && (
                        <GiftModal
                            isOpen={showGiftModal}
                            onClose={() => setShowGiftModal(false)}
                            authorId={story.authorId}
                            authorName={story.authorName}
                            storyId={story.id}
                            storyTitle={story.title}
                        />
                    )}
                </AnimatePresence>

                {/* ADMIN FOOTER */}
                {isAdminView && (
                    <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 w-full p-3 md:p-4 z-[80] bg-[#111625]/95 backdrop-blur-xl border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-3">
                        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                            <div className={`px-3 py-2 rounded-xl border font-bold flex items-center gap-2 text-xs md:text-sm ${hasIssues ? 'bg-orange-500/10 border-orange-500/50 text-orange-500' : 'bg-slate-800 border-white/10 text-slate-400'}`}>
                                {hasIssues ? <AlertTriangle size={16} /> : <Check size={16} />}
                                <span>{hasIssues ? `${issuesCount} Issues` : "Clear"}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setConfirmAction('reject')}
                                disabled={isSubmittingReview}
                                className="flex-1 md:flex-none px-4 py-3 rounded-xl font-bold text-xs md:text-sm transition-all bg-red-600 hover:bg-red-500 text-white shadow-lg"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => setConfirmAction('return')}
                                disabled={!hasIssues || isSubmittingReview}
                                className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold text-xs md:text-sm transition-all
                                    ${hasIssues
                                        ? "bg-orange-600 hover:bg-orange-500 text-white shadow-lg"
                                        : "bg-slate-800 text-slate-400 cursor-not-allowed"}
                                `}
                            >
                                Request Changes
                            </button>

                            <button
                                onClick={() => setConfirmAction('approve')}
                                disabled={hasIssues || isSubmittingReview}
                                className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold text-xs md:text-sm transition-all
                                ${!hasIssues
                                        ? "bg-green-600 hover:bg-green-500 text-white shadow-lg"
                                        : "bg-slate-700 text-slate-400 cursor-not-allowed"}
                            `}
                            >
                                Publish
                            </button>
                        </div>
                    </motion.div>
                )}

                {isAuthorView && (
                    <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 w-full p-4 z-[80] bg-[#111625]/95 backdrop-blur-xl border-t border-white/10 flex justify-end items-center">
                        <button onClick={handleEditRedirect} className="w-full md:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg flex items-center justify-center gap-2"><Hammer size={18} /> Edit & Fix Issues</button>
                    </motion.div>
                )}

                <AnimatePresence>
                    {confirmAction && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                            <div className="bg-[#1A1F2E] border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
                                <h3 className="text-xl md:text-2xl font-black text-white mb-2">
                                    {confirmAction === 'approve'
                                        ? "Publish Story?"
                                        : confirmAction === 'reject'
                                            ? "Reject Story?"
                                            : "Return to Author?"}
                                </h3>
                                <div className="flex gap-3 mt-6">
                                    <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 rounded-xl font-bold bg-slate-800 text-slate-300">Cancel</button>
                                    <button
                                        onClick={confirmAction === 'approve' ? processApprove : confirmAction === 'reject' ? processReject : processReturn}
                                        className={`flex-1 py-3 rounded-xl font-bold text-white ${confirmAction === 'reject' ? 'bg-red-600' : 'bg-orange-600'}`}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </ReviewContext.Provider>
    );
}

// 🛡️ FIXED REVIEW SECTION COMPONENT
const ReviewSection = ({
    id,
    label,
    children,
    className = "",
    flagPosition = "right-0 -top-2 md:-right-3 md:-top-3",
}) => {
    const context = useContext(ReviewContext);
    const { isAdminView, isAuthorView, feedback, toggleFeedback, isResubmission } = context || {};

    const [isOpen, setIsOpen] = useState(false);
    const [comment, setComment] = useState("");

    const hasIssue = !!feedback?.[id];
    const shouldShowFlag = isAdminView || (isAuthorView && hasIssue);

    useEffect(() => {
        if (feedback?.[id]) setComment(feedback[id]);
        else setComment("");
    }, [feedback, id, isOpen]);

    if (!context) return <div className={className}>{children}</div>;

    if (!shouldShowFlag) {
        return <div className={className}>{children}</div>;
    }

    const flagClasses = hasIssue
        ? isResubmission
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-red-600 hover:bg-red-500 text-white"
        : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50";

    const handleFlagClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
    };

    return (
        <div className={`relative ${className}`}>

            {/* CONTENT */}
            <div className="relative z-10">
                {children}
            </div>

            {/* FLAG BUTTON (SEPARATE LAYER) */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <button
                    type="button"
                    onClick={handleFlagClick}
                    className={`absolute ${flagPosition} pointer-events-auto z-30 p-2 rounded-full shadow-xl transition-transform hover:scale-110 cursor-pointer ${flagClasses}`}
                >
                    <Flag size={16} />
                </button>
            </div>


            {/* AUTHOR BADGE */}
            {!isAdminView && isAuthorView && hasIssue && (
                <div
                    className={`absolute ${flagPosition} z-[50] px-3 py-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 animate-pulse`}
                >
                    <AlertTriangle size={12} />
                    Action Required
                </div>
            )}

            {/* MODAL — PORTALED TO BODY */}
            {isOpen &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                        <div
                            className="relative w-full max-w-md bg-[#1A1F2E] border border-white/10 rounded-2xl shadow-2xl p-6 z-[100001]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    {isResubmission ? "Verify Modification" : `Flag: ${label}`}
                                </span>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-full"
                                >
                                    <X size={18} className="text-slate-400 hover:text-white" />
                                </button>
                            </div>

                            <textarea
                                className="w-full h-32 bg-black/30 border border-white/10 rounded-xl p-4 text-white resize-none mb-5 focus:outline-none focus:border-orange-500"
                                placeholder="Describe exactly what needs to be changed..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                autoFocus={isAdminView}
                                readOnly={!isAdminView}
                            />

                            <div className="flex gap-3 items-center">
                                {isAdminView ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                if (!comment.trim()) {
                                                    toast.error("Please describe the issue");
                                                    return;
                                                }
                                                toggleFeedback(id, comment);
                                                setIsOpen(false);
                                                toast.success("Issue flagged");
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                                        >
                                            Flag Issue
                                        </button>

                                        {hasIssue && (
                                            <button
                                                onClick={() => {
                                                    toggleFeedback(id, null);
                                                    setComment("");
                                                    setIsOpen(false);
                                                    toast.success("Flag removed");
                                                }}
                                                className="px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center gap-2"
                                            >
                                                <Check size={18} />
                                                Remove
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold"
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};
