import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom"; 
import { 
  collection, query, getDocs, doc, orderBy, deleteDoc, setDoc, getDoc, onSnapshot, updateDoc 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth, storage } from "../services/firebase";
import { 
  ShieldAlert, Layout, MapPin, Tag, Zap, 
  Award, List, Gem, Edit2, Trash2, Save, 
  Plus, Search, X, Gift, LogOut, Sun, Moon, User, 
  CheckCircle, RotateCcw, Eye, Clock, Image as ImageIcon, UploadCloud, Menu,
  AlertCircle, ArrowUp, ArrowDown, Filter, History
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import * as LucideIcons from "lucide-react"; 
import { formatDistanceToNow } from 'date-fns';
import { sendNotification } from "../services/notificationService";

// --- CONSTANTS ---
const SCROLLBAR_STYLES = `
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #64748b; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
`;

const ICON_LIST = [
  "Mountain", "Tent", "Trees", "TreePine", "Flower", "Leaf", "Palmtree", 
  "Sun", "Moon", "Cloud", "CloudRain", "Snowflake", "Wind", "Droplets", 
  "Flame", "Waves", "Sunset", "Sunrise", "Umbrella", "Feather",
  "Plane", "Car", "Bike", "Bus", "Train", "Ship", "Anchor", "Sailboat", 
  "Map", "MapPin", "Compass", "Globe", "Navigation", "Ticket", "Luggage", 
  "Backpack", "Briefcase", "Key", "Landmark", "Building", "LifeBuoy",
  "Camera", "Image", "Video", "Film", "Music", "Mic", "Headphones", "Speaker",
  "Palette", "Brush", "PenTool", "Book", "BookOpen", "Gamepad", "Puzzle",
  "Dumbbell", "Footprints", "Fish", "Binoculars",
  "Coffee", "Utensils", "Pizza", "Beer", "Wine", "Martini", "CupSoda", 
  "Cake", "Apple", "Carrot", "Soup", "IceCream",
  "Star", "Heart", "Zap", "Trophy", "Award", "Medal", "Crown", "Gem", 
  "Diamond", "Shield", "Target", "Flag", "Sparkles", "Rocket", "Ghost", 
  "Skull", "ThumbsUp", "Smile", "Meh", "Frown", "Coins", "CreditCard",
  "Check", "CheckCircle", "X", "XCircle", "AlertCircle", "Info", "HelpCircle", 
  "User", "Users", "UserPlus", "Lock", "Unlock", "Eye", "EyeOff", 
  "Settings", "Filter", "Search", "Tag", "Link", "Home", "Bell", "Calendar", 
  "Clock", "Watch", "Gift", "ShoppingBag", "DollarSign", "Droplet", "Hexagon", "Circle"
];

const COLOR_PALETTE = [
  { name: "slate", hex: "#64748b" }, { name: "red", hex: "#ef4444" },
  { name: "orange", hex: "#f97316" }, { name: "amber", hex: "#f59e0b" },
  { name: "yellow", hex: "#eab308" }, { name: "lime", hex: "#84cc16" },
  { name: "green", hex: "#22c55e" }, { name: "emerald", hex: "#10b981" },
  { name: "teal", hex: "#14b8a6" }, { name: "cyan", hex: "#06b6d4" },
  { name: "sky", hex: "#0ea5e9" }, { name: "blue", hex: "#3b82f6" },
  { name: "indigo", hex: "#6366f1" }, { name: "violet", hex: "#8b5cf6" },
  { name: "purple", hex: "#a855f7" }, { name: "fuchsia", hex: "#d946ef" },
  { name: "pink", hex: "#ec4899" }, { name: "rose", hex: "#f43f5e" }
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("moderation");
  const [isDarkMode, setIsDarkMode] = useState(true); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  const handleLogout = async () => {
    if(window.confirm("Are you sure you want to logout?")) {
        try {
            await signOut(auth);
            toast.success("Logged out successfully");
        } catch (error) {
            toast.error("Logout failed");
        }
    }
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'bg-[#0B0F19] text-white' : 'bg-slate-50 text-slate-900'} font-sans overflow-hidden transition-colors duration-300`}>
      <style>{SCROLLBAR_STYLES}</style>
      <Toaster position="bottom-right" toastOptions={{ style: { background: isDarkMode ? '#1e293b' : '#fff', color: isDarkMode ? '#fff' : '#0f172a', border: '1px solid #334155' } }} />

      {/* MOBILE HEADER */}
      <div className={`md:hidden fixed top-0 w-full z-40 p-4 border-b flex items-center justify-between ${isDarkMode ? 'bg-[#111625] border-white/5' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 font-black text-lg">
              <ShieldAlert className="text-orange-500" size={20} /> Admin
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg bg-slate-100 dark:bg-white/5">
              {isSidebarOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`
        fixed md:relative z-30 w-64 border-r flex flex-col shrink-0 h-screen overflow-hidden transition-all duration-300
        ${isDarkMode ? 'bg-[#111625] border-white/5' : 'bg-white border-slate-200 shadow-sm'}
        ${isSidebarOpen ? 'left-0' : '-left-64 md:left-0'}
      `}>
        <div className={`p-6 border-b shrink-0 ${isDarkMode ? 'border-white/5' : 'border-slate-100'} hidden md:block`}>
           <h1 className="text-xl font-black flex items-center gap-2 tracking-tight">
                <ShieldAlert className="text-orange-500" size={24} /> 
                <span>Admin<span className="text-slate-500">Suite</span></span>
           </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar mt-16 md:mt-0">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 mt-4">Core</div>
            <SidebarItem icon={<Layout size={18}/>} label="Story Moderation" active={activeTab === "moderation"} onClick={() => {setActiveTab("moderation"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>
            <SidebarItem icon={<ImageIcon size={18}/>} label="Site Branding" active={activeTab === "branding"} onClick={() => {setActiveTab("branding"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>

            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 mt-6">Master Data</div>
            <SidebarItem icon={<MapPin size={18}/>} label="Trip Types" active={activeTab === "tripTypes"} onClick={() => {setActiveTab("tripTypes"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>
            <SidebarItem icon={<Tag size={18}/>} label="Categories" active={activeTab === "categories"} onClick={() => {setActiveTab("categories"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>
            <SidebarItem icon={<Zap size={18}/>} label="Difficulty Levels" active={activeTab === "difficultyLevels"} onClick={() => {setActiveTab("difficultyLevels"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>

            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 mt-6">Gamification</div>
            <SidebarItem icon={<Award size={18}/>} label="Badges" active={activeTab === "badges"} onClick={() => {setActiveTab("badges"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>
            <SidebarItem icon={<List size={18}/>} label="Ranks" active={activeTab === "ranks"} onClick={() => {setActiveTab("ranks"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>
            <SidebarItem icon={<Gift size={18}/>} label="Loot Box (Heirlooms)" active={activeTab === "loot"} onClick={() => {setActiveTab("loot"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>
            <SidebarItem icon={<Gem size={18}/>} label="Treasures" active={activeTab === "treasures"} onClick={() => {setActiveTab("treasures"); setIsSidebarOpen(false);}} isDark={isDarkMode}/>
        </nav>

        <div className={`p-4 border-t mt-auto ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    <User size={20} />
                </div>
                <div className="overflow-hidden">
                    <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Admin</p>
                    <p className="text-xs text-slate-500 truncate">{auth.currentUser?.email || "admin@journeys.com"}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors
                    ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-600'}`}
                >
                    {isDarkMode ? <Sun size={16}/> : <Moon size={16}/>} 
                    {isDarkMode ? "Light" : "Dark"}
                </button>
                <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                >
                    <LogOut size={16}/> Logout
                </button>
            </div>
        </div>
      </aside>

      <main className={`flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 scroll-smooth custom-scrollbar ${isDarkMode ? 'bg-[#0B0F19]' : 'bg-slate-50'}`}>
        <div className="max-w-5xl mx-auto pb-20">
            {activeTab === "moderation" && <StoryModeration isDark={isDarkMode}/>}
            {activeTab === "branding" && <LogoManager isDark={isDarkMode}/>}
            {activeTab === "tripTypes" && <MetaEditor title="Trip Types" docId="tripTypes" fields={['label', 'value', 'description', 'color', 'icon']} isDark={isDarkMode}/>}
            {activeTab === "categories" && <MetaEditor title="Categories (Terrain)" docId="categories" fields={['label', 'value', 'description', 'color', 'icon']} isDark={isDarkMode}/>}
            {activeTab === "difficultyLevels" && <MetaEditor title="Difficulty Levels" docId="difficultyLevels" fields={['label', 'value', 'description', 'color', 'icon']} isDark={isDarkMode}/>}
            {activeTab === "badges" && <MetaEditor title="Badges" docId="badges" fields={['name', 'value', 'description', 'color', 'icon']} isDark={isDarkMode}/>}
            {activeTab === "ranks" && <MetaEditor title="Ranks" docId="ranks" fields={['name', 'threshold', 'perk', 'color', 'icon']} isDark={isDarkMode}/>}
            {activeTab === "loot" && <ManageLoot isDark={isDarkMode}/>}
            {activeTab === "treasures" && <MetaEditor title="Hidden Treasures" docId="treasures" fields={['name', 'points', 'color', 'icon']} isDark={isDarkMode}/>}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, isDark }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm mx-1 mb-1
            ${active 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
            {icon} {label}
        </button>
    )
}

// --- 🛡️ UPGRADED STORY MODERATION (FIXED) ---
function StoryModeration({ isDark }) {
    const [allStories, setAllStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("pending");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState("desc"); 
    const navigate = useNavigate();

    // ⚡ STATE FOR RETURN MODAL
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [storyToReturn, setStoryToReturn] = useState(null);
    const [returnReason, setReturnReason] = useState(""); 
    const [isReturning, setIsReturning] = useState(false); 

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            // 🛡️ SECURITY FIX: Explicitly check email before fetching
            // This prevents the "Permission Denied" error loop
            if (!user || user.email !== "sjsubratajana@gmail.com") {
                setLoading(false);
                return; 
            }

            try {
                const q = query(collection(db, "stories"), orderBy("updatedAt", sortOrder));
                const snap = await getDocs(q);
                const fetched = snap.docs.map((d) => ({ 
                    id: d.id, 
                    ...d.data(),
                    status: d.data().status || (d.data().published ? 'pending' : 'draft') 
                }));
                setAllStories(fetched);
            } catch (error) {
                console.error("Error fetching stories:", error);
                // toast.error("Could not load stories"); // Suppress toast on initial load to keep UI clean
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [sortOrder]); 

    // ⚡ FILTER & SEARCH LOGIC
    const filteredStories = useMemo(() => {
        let stories = allStories;

        if (filterStatus !== 'all') {
            stories = stories.filter(story => {
                if (filterStatus === 'pending') {
                    return story.published && story.status !== 'approved' && story.status !== 'returned';
                }
                return story.status === filterStatus;
            });
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            stories = stories.filter(s => 
                (s.title && s.title.toLowerCase().includes(q)) || 
                (s.authorName && s.authorName.toLowerCase().includes(q))
            );
        }

        return stories;
    }, [allStories, filterStatus, searchQuery]);

    // ⚡ STATS CALCULATION
    const stats = useMemo(() => {
        const pending = allStories.filter(s => s.published && s.status !== 'approved' && s.status !== 'returned').length;
        const approved = allStories.filter(s => s.status === 'approved').length;
        const total = allStories.length;
        return { pending, approved, total };
    }, [allStories]);

    const handleReview = (story) => {
        navigate(`/story/${story.id}`, { state: { adminView: true } });
    };

    const handleDelete = async (id) => {
        if(!window.confirm("Permanently delete this story?")) return;
        try {
            await deleteDoc(doc(db, "stories", id));
            setAllStories(prev => prev.filter(s => s.id !== id));
            toast.success("Story deleted");
        } catch (e) { toast.error("Failed to delete"); }
    };

    const openReturnModal = (story) => {
        setStoryToReturn(story);
        setReturnReason(""); 
        setShowReturnModal(true);
    };

    const submitReturn = async () => {
        if (!storyToReturn) return;
        const existingFeedback = storyToReturn.feedback || {};
        const hasFlags = Object.keys(existingFeedback).length > 0;
        const note = returnReason.trim();

        if (!hasFlags && !note) return toast.error("Please enter a reason or flag issues.");

        setIsReturning(true);
        try {
            const storyRef = doc(db, "stories", storyToReturn.id);
            const finalFeedback = { ...existingFeedback };
            if (note) finalFeedback.general = note; 

            await updateDoc(storyRef, {
                status: "returned",
                published: false, 
                adminNotes: note || "Please check flagged items.", 
                feedback: finalFeedback
            });

            await sendNotification({
                recipientId: storyToReturn.authorId,
                type: 'alert',
                title: 'Action Required: Story Returned',
                message: `Admin has requested changes on "${storyToReturn.title}". Reason: ${note || "See flagged items."}`,
                link: `/create-story?edit=${storyToReturn.id}`
            });

            setAllStories(prev => prev.map(s => s.id === storyToReturn.id ? { 
                ...s, status: "returned", published: false, adminNotes: note, feedback: finalFeedback
            } : s));
            
            toast.success("Story returned to author!");
            setShowReturnModal(false);
        } catch (error) {
            toast.error("Failed to return story.");
        } finally {
            setIsReturning(false);
        }
    };

    const StatusTab = ({ id, label, icon: Icon, count, color }) => (
        <button 
            onClick={() => setFilterStatus(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all relative overflow-hidden group
            ${filterStatus === id 
                ? `${color} shadow-lg scale-105` 
                : isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'
            }`}
        >
            <Icon size={16} className="relative z-10"/> <span className="relative z-10">{label}</span>
            {count !== undefined && <span className={`relative z-10 ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${filterStatus === id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-800'}`}>{count}</span>}
        </button>
    );

    const cardClass = isDark ? "bg-[#111625] border-white/5" : "bg-white border-slate-200 shadow-sm";
    const issueCount = storyToReturn ? Object.keys(storyToReturn.feedback || {}).length : 0;

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return "N/A";
        try {
            return formatDistanceToNow(new Date(timestamp.seconds * 1000), { addSuffix: true });
        } catch (e) { return "Unknown"; }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
            <div className="grid grid-cols-3 gap-4 mb-2">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">Pending Review</div>
                    <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{stats.pending}</div>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-100'}`}>
                    <div className="text-xs font-bold uppercase tracking-wider text-green-500 mb-1">Approved</div>
                    <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{stats.approved}</div>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Total Stories</div>
                    <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{stats.total}</div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className={`text-3xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <ShieldAlert className="text-orange-500"/> Story Moderation
                </h2>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className={`relative flex-1 md:w-64`}>
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input 
                            type="text" 
                            placeholder="Search title or author..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none border transition-colors ${isDark ? 'bg-black/20 border-white/10 text-white focus:border-orange-500' : 'bg-white border-slate-200 text-slate-800 focus:border-orange-500'}`}
                        />
                    </div>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className={`px-3 rounded-xl border flex items-center gap-2 text-sm font-bold transition-all ${isDark ? 'bg-black/20 border-white/10 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        title={sortOrder === 'desc' ? "Newest First" : "Oldest First"}
                    >
                        {sortOrder === 'desc' ? <ArrowDown size={16}/> : <ArrowUp size={16}/>}
                        <span className="hidden md:inline">Sort</span>
                    </button>
                </div>
            </div>

            <div className={`p-1.5 rounded-xl flex flex-wrap gap-2 ${isDark ? 'bg-black/20 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
                <StatusTab id="pending" label="Pending" icon={Clock} count={stats.pending} color="bg-blue-600 text-white" />
                <StatusTab id="approved" label="Approved" icon={CheckCircle} count={stats.approved} color="bg-green-600 text-white" />
                <StatusTab id="returned" label="Returned" icon={RotateCcw} color="bg-orange-600 text-white" />
                <StatusTab id="all" label="All" icon={List} color="bg-slate-600 text-white" />
            </div>

            <div className={`rounded-2xl border overflow-hidden shadow-2xl ${cardClass}`}>
                <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className={`text-xs uppercase font-bold ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                        <tr>
                            <th className="p-4">Story & Revisions</th>
                            <th className="p-4">Author</th>
                            <th className="p-4">Timeline</th> 
                            <th className="p-4">Status & Aging</th> 
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y text-sm ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {loading && <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading...</td></tr>}
                        {!loading && filteredStories.length === 0 && <tr><td colSpan="5" className="p-12 text-center opacity-50 italic">No stories found.</td></tr>}
                        
                        {filteredStories.map(story => (
                            <tr key={story.id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                                <td className="p-4 max-w-[250px]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-slate-800 shrink-0 overflow-hidden relative">
                                            {story.coverImage ? <img src={story.coverImage} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full flex items-center justify-center text-slate-500"><ImageIcon size={16}/></div>}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{story.title || "Untitled"}</div>
                                                {story.revisionCount > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-white flex items-center gap-1" title="Revision Count">
                                                        <History size={10}/> v{story.revisionCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                <MapPin size={10}/> {story.location || "Unknown"}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className={`p-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold overflow-hidden">
                                            {story.authorName?.[0] || <User size={12}/>}
                                        </div>
                                        {story.authorName || "Unknown"}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-xs font-medium text-emerald-500 flex items-center gap-1" title="Last Updated">
                                            <ArrowUp size={10}/> Last: {story.updatedAt?.seconds ? new Date(story.updatedAt.seconds * 1000).toLocaleDateString() : "N/A"}
                                        </div>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-1" title="First Submitted">
                                            <ArrowDown size={10}/> First: {story.createdAt?.seconds ? new Date(story.createdAt.seconds * 1000).toLocaleDateString() : "N/A"}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide inline-flex items-center gap-1.5
                                            ${story.status === 'approved' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                                              story.status === 'returned' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 
                                              story.published ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                              'bg-slate-500/10 text-slate-500 border border-slate-500/20'}
                                        `}>
                                            {story.status === 'approved' && <CheckCircle size={12}/>}
                                            {story.status === 'returned' && <RotateCcw size={12}/>}
                                            {story.published && story.status !== 'approved' && story.status !== 'returned' && <Clock size={12}/>}
                                            {story.status || (story.published ? "Pending" : "Draft")}
                                        </span>
                                        {story.published && story.status !== 'approved' && story.status !== 'returned' && (
                                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 ml-1">
                                                ⏳ Waited: {formatTimeAgo(story.updatedAt)}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleReview(story)} 
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg flex items-center gap-2 font-bold transition-all hover:scale-105 text-xs"
                                        >
                                            <Eye size={14}/> Review
                                        </button>
                                        {story.status !== 'approved' && story.status !== 'returned' && (
                                            <button 
                                                onClick={() => openReturnModal(story)}
                                                className="px-3 py-2 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-all font-bold"
                                                title="Return to Author"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDelete(story.id)} 
                                            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors" 
                                            title="Delete"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            {/* ⚡ RETURN MODAL ⚡ */}
            {showReturnModal && storyToReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm p-8 rounded-3xl shadow-2xl bg-[#1A1F2E] border border-white/10 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"/>
                        
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-6 border border-orange-500/20">
                                <AlertCircle size={32} className="text-orange-500" />
                            </div>
                            
                            <h3 className="text-xl font-bold text-white mb-2">Return to Author?</h3>
                            
                            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                {issueCount > 0 
                                  ? `You have flagged ${issueCount} specific issue${issueCount !== 1 ? 's' : ''}.` 
                                  : "No specific items flagged."} 
                                <br/>Add a note below (optional if flagged).
                            </p>

                            <textarea 
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                                className="w-full h-24 bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm mb-6 focus:outline-none focus:border-orange-500 resize-none placeholder:text-white/20"
                                placeholder="Explain what needs to be fixed..."
                            />

                            <div className="flex gap-3 w-full">
                                <button 
                                    onClick={() => setShowReturnModal(false)}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
                                    disabled={isReturning}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={submitReturn}
                                    disabled={isReturning}
                                    className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                                >
                                    {isReturning ? "Returning..." : "Yes, Return"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    ); 
}

// --- SUB COMPONENTS (LOGO, LOOT, META) ---
// Kept exactly as provided to maintain full functionality

function LogoManager({ isDark }) {
    const [logoUrl, setLogoUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, "meta", "site_config");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setLogoUrl(docSnap.data().logoUrl || "");
                }
            } catch (e) {
                console.error("Error fetching config:", e);
                toast.error("Could not load site config");
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleLogoUpload = async (file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            return toast.error("File size must be less than 2MB");
        }
        const toastId = toast.loading("Uploading Logo...");
        setUploading(true);
        try {
            const fileRef = ref(storage, `site_assets/logo_${Date.now()}.png`);
            await uploadBytes(fileRef, file);
            const downloadUrl = await getDownloadURL(fileRef);
            const configRef = doc(db, "meta", "site_config");
            await setDoc(configRef, { logoUrl: downloadUrl }, { merge: true });
            setLogoUrl(downloadUrl);
            toast.success("Logo Updated Successfully!", { id: toastId });
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to upload logo", { id: toastId });
        } finally {
            setUploading(false);
        }
    };
    const cardClass = isDark ? "bg-[#111625] border-white/5" : "bg-white border-slate-200 shadow-sm";
    return (
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
             <h2 className={`text-3xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                 <ImageIcon className="text-orange-500"/> Site Branding
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className={`p-8 rounded-2xl border flex flex-col items-center justify-center gap-6 ${cardClass}`}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Current Logo</h3>
                    <div className="relative w-40 h-40 rounded-full border-4 border-dashed border-slate-700/50 flex items-center justify-center bg-slate-900/50 overflow-hidden group">
                        {loading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div> : logoUrl ? <img src={logoUrl} alt="Site Logo" className="w-full h-full object-contain p-2" /> : <div className="text-slate-500 text-xs text-center px-4">No Logo Uploaded</div>}
                    </div>
                    <p className="text-xs text-slate-500 text-center max-w-xs">This logo will appear on the Login screen, Dashboard sidebar, and Landing page header.</p>
                 </div>
                 <div className={`p-8 rounded-2xl border flex flex-col justify-center ${cardClass}`}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Update Logo</h3>
                    <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50/5 transition-all ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-orange-500/50'} ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-300 bg-slate-50'}`}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className={`w-10 h-10 mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-slate-500">PNG, JPG or SVG (Max 2MB)</p>
                            <p className="text-xs text-orange-500 mt-2 font-medium">Recommended: 512x512px Transparent PNG</p>
                        </div>
                        <input type="file" className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => handleLogoUpload(e.target.files[0])} disabled={uploading}/>
                    </label>
                    {uploading && <div className="mt-4 flex items-center gap-2 text-xs text-orange-500 font-bold justify-center animate-pulse"><div className="w-2 h-2 bg-orange-500 rounded-full"/> Uploading new logo...</div>}
                 </div>
             </div>
        </div>
    );
}

function ManageLoot({ isDark }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ name: "", category: "plane", rarity: "Common", icon: "Circle" });
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
    const [iconSearch, setIconSearch] = useState("");
  
    useEffect(() => {
      const unsub = onSnapshot(doc(db, "meta", "loot"), (docSnap) => {
        if (docSnap.exists()) setItems(docSnap.data().items || []);
        setLoading(false);
      });
      return () => unsub();
    }, []);
  
    const handleSave = async () => {
      if (!formData.name) return toast.error("Enter a name!");
      let chance = 60;
      if (formData.rarity === "Uncommon") chance = 90;
      if (formData.rarity === "LEGENDARY") chance = 100;
  
      const newId = formData.name.toLowerCase().replace(/\s+/g, "_");
      const newItem = { id: newId, name: formData.name, category: formData.category, rarity: formData.rarity, chance: chance, icon: formData.icon };
      const filtered = items.filter(i => i.id !== newId);
      const updatedList = [...filtered, newItem];
  
      try {
        await setDoc(doc(db, "meta", "loot"), { items: updatedList });
        setFormData({ ...formData, name: "" });
        toast.success("Heirloom Saved!");
      } catch (error) {
        toast.error("Error saving.");
      }
    };
  
    const handleDelete = async (idToDelete) => {
      if(!window.confirm("Delete this item?")) return;
      const updatedList = items.filter(item => item.id !== idToDelete);
      await setDoc(doc(db, "meta", "loot"), { items: updatedList });
      toast.success("Deleted");
    };

    const renderIcon = (iconName) => {
        const IconComponent = LucideIcons[iconName] || LucideIcons.HelpCircle;
        return <IconComponent size={18} />;
    };

    const filteredIcons = useMemo(() => {
        if (!iconSearch) return ICON_LIST;
        return ICON_LIST.filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase()));
    }, [iconSearch]);

    const cardClass = isDark ? "bg-[#111625] border-white/5" : "bg-white border-slate-200 shadow-sm";
    const inputClass = isDark ? "w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-600" : "w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-orange-500 placeholder:text-slate-400";
    const pickerClass = isDark ? "bg-[#1A1F2E] border-white/10" : "bg-white border-slate-200 shadow-xl";
  
    return (
      <div className="space-y-8 animate-in slide-in-from-right duration-500">
         <h2 className={`text-3xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
             <Gift className="text-orange-500"/> Manage Heirlooms
         </h2>
  
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className={`p-6 rounded-2xl border h-fit z-20 ${cardClass}`}>
            <h2 className={`font-bold mb-6 uppercase text-xs tracking-wider border-b pb-2 ${isDark ? 'text-orange-500 border-white/5' : 'text-orange-600 border-slate-100'}`}>Add / Edit Artifact</h2>
            
            <div className="mb-4">
              <label className="block text-slate-400 text-xs mb-1 font-bold uppercase">Item Name</label>
              <input className={inputClass} placeholder="e.g. Silver Compass" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-slate-400 text-xs mb-1 font-bold uppercase">Source</label>
              <select className={inputClass} value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                <option value="plane" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>✈️ Paper Plane</option>
                <option value="boat" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>⛵ Paper Boat</option>
                <option value="bottle" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>🍾 Glass Bottle</option>
                <option value="lantern" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>🏮 Sky Lantern</option>
                <option value="box" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>📦 Bronze Box</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-slate-400 text-xs mb-1 font-bold uppercase">Rarity</label>
              <select className={inputClass} value={formData.rarity} onChange={(e) => setFormData({...formData, rarity: e.target.value})}>
                <option value="Common" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>⚪ Common (60%)</option>
                <option value="Uncommon" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>🟢 Uncommon (30%)</option>
                <option value="LEGENDARY" className={isDark ? "bg-[#1A1F2E]" : "bg-white"}>🟡 LEGENDARY (10%)</option>
              </select>
            </div>
            <div className="mb-6 relative">
              <label className="block text-slate-400 text-xs mb-1 font-bold uppercase">Icon</label>
              <button onClick={() => { setIsIconPickerOpen(!isIconPickerOpen); setIconSearch(""); }} className={`${inputClass} flex items-center gap-3 text-left`}>
                  <div className={`p-2 rounded-lg text-orange-400 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>{renderIcon(formData.icon)}</div>
                  <span className={isDark ? "text-slate-400" : "text-slate-600"}>{formData.icon}</span>
              </button>
              {isIconPickerOpen && (
                <div className={`absolute top-full left-0 mt-2 w-full border rounded-xl shadow-2xl z-50 overflow-hidden ${pickerClass}`}>
                    <div className={`p-3 border-b sticky top-0 z-10 ${isDark ? 'bg-[#1A1F2E] border-white/5' : 'bg-white border-slate-100'}`}>
                        <input type="text" autoFocus placeholder="Search..." className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none ${isDark ? 'bg-black/30 text-white' : 'bg-slate-100 text-slate-900'}`} value={iconSearch} onChange={(e) => setIconSearch(e.target.value)} />
                    </div>
                    <div className="p-2 grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                        {filteredIcons.map(iconName => (
                            <button key={iconName} onClick={() => { setFormData({...formData, icon: iconName}); setIsIconPickerOpen(false); }} className={`p-2 rounded-lg flex justify-center hover:bg-black/5 ${formData.icon === iconName ? 'bg-orange-500 text-white' : 'text-slate-400'}`} title={iconName}>
                                {renderIcon(iconName)}
                            </button>
                        ))}
                    </div>
                </div>
              )}
            </div>
            <button onClick={handleSave} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 shadow-lg shadow-orange-900/20">
              <Save size={18}/> SAVE HEIRLOOM
            </button>
          </div>
  
          <div className="xl:col-span-2 space-y-6">
              {loading && <p>Loading...</p>}
              {['plane', 'boat', 'bottle', 'lantern', 'box'].map(cat => {
                const catItems = items.filter(i => i.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} className={`p-5 rounded-2xl border ${cardClass}`}>
                      <h3 className={`uppercase text-xs font-bold mb-4 border-b pb-2 flex items-center gap-2 ${isDark ? 'text-slate-500 border-white/5' : 'text-slate-400 border-slate-100'}`}>
                          {cat === 'plane' && <span>✈️ Plane Collection</span>}
                          {cat === 'boat' && <span>⛵ Boat Collection</span>}
                          {cat === 'bottle' && <span>🍾 Bottle Collection</span>}
                          {cat === 'lantern' && <span>🏮 Lantern Collection</span>}
                          {cat === 'box' && <span>📦 Bronze Box Collection</span>}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {catItems.map(item => (
                              <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border relative group ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0
                                      {item.rarity === 'Common' ? 'bg-slate-500' : item.rarity === 'Uncommon' ? 'bg-emerald-600' : 'bg-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.3)]'}
                                  `}>{renderIcon(item.icon)}</div>
                                  <div className="flex-1 min-w-0">
                                      <p className={`font-bold text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.name}</p>
                                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{item.rarity}</p>
                                  </div>
                                  <button onClick={() => handleDelete(item.id)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-1 rounded transition"><Trash2 size={14} /></button>
                              </div>
                          ))}
                      </div>
                  </div>
                )
             })}
          </div>
        </div>
      </div>
    );
}

function MetaEditor({ title, docId, fields, isDark }) {
    const [items, setItems] = useState([]);
    const [newItem, setNewItem] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
    const [iconSearch, setIconSearch] = useState("");

    useEffect(() => {
        const loadData = async () => {
            try {
                const snap = await getDoc(doc(db, "meta", docId));
                if (snap.exists()) setItems(snap.data().items || []);
                else setItems([]); 
            } catch (e) { console.error("Load failed", e); }
        };
        loadData();
    }, [docId]);

    const handleSave = async () => {
        const primaryField = fields[0];
        if (!newItem[primaryField]) return toast.error(`${primaryField} is required`);
        const toastId = toast.loading("Saving...");
        try {
            const itemToSave = { id: editingId || Date.now().toString(), ...newItem };
            let updatedItems = editingId ? items.map(i => i.id === editingId ? itemToSave : i) : [...items, itemToSave];
            await setDoc(doc(db, "meta", docId), { items: updatedItems });
            setItems(updatedItems);
            setNewItem({});
            setEditingId(null);
            setIsIconPickerOpen(false);
            toast.success("Saved!", { id: toastId });
        } catch (e) { toast.error("Failed to save", { id: toastId }); }
    };

    const handleDelete = async (id) => {
        if(!window.confirm("Delete this item?")) return;
        try {
            const updatedItems = items.filter(i => i.id !== id);
            await setDoc(doc(db, "meta", docId), { items: updatedItems });
            setItems(updatedItems);
            toast.success("Deleted");
        } catch(e) { toast.error("Delete failed"); }
    };

    const handleEdit = (item) => { setNewItem(item); setEditingId(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const filteredIcons = useMemo(() => { if (!iconSearch) return ICON_LIST; return ICON_LIST.filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase())); }, [iconSearch]);
    const renderIcon = (iconName) => { if (!iconName) return <Plus size={20} />; const IconComponent = LucideIcons[iconName]; return IconComponent ? <IconComponent size={20} /> : <Plus size={20} />; };

    const cardClass = isDark ? "bg-[#111625] border-white/5" : "bg-white border-slate-200 shadow-sm";
    const inputClass = isDark ? "w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-orange-500 outline-none placeholder:text-slate-600" : "w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:border-orange-500 outline-none placeholder:text-slate-400";
    const pickerClass = isDark ? "bg-[#1A1F2E] border-white/10" : "bg-white border-slate-200 shadow-xl";

    return (
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className={`text-3xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <Edit2 className="text-slate-500"/> Manage: {title}
            </h2>

            <div className={`p-6 rounded-2xl border relative z-20 ${cardClass}`}>
                <h3 className="text-sm font-bold text-orange-500 uppercase mb-4">{editingId ? "Edit Item" : "Add New Item"}</h3>
                <div className="grid grid-cols-1 gap-6 mb-6">
                    {fields.map(field => (
                        <div key={field}>
                            <label className="text-xs text-slate-500 uppercase font-bold ml-1 block mb-2">{field}</label>
                            {field === 'color' ? (
                                <div className={`flex flex-wrap gap-3 p-3 rounded-xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    {COLOR_PALETTE.map(c => (
                                        <button key={c.name} onClick={() => setNewItem({...newItem, color: c.name})} className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${newItem.color === c.name ? 'border-white scale-110 ring-2 ring-white/20' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: c.hex }} title={c.name} />
                                    ))}
                                </div>
                            ) : field === 'icon' ? (
                                <div className="relative">
                                    <button onClick={() => { setIsIconPickerOpen(!isIconPickerOpen); setIconSearch(""); }} className={`${inputClass} flex items-center gap-3 text-left`}>
                                            <div className={`p-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>{renderIcon(newItem.icon)}</div>
                                            <span className={isDark ? "text-slate-400" : "text-slate-600"}>{newItem.icon ? newItem.icon : "Click to select..."}</span>
                                    </button>
                                    {isIconPickerOpen && (
                                        <div className={`absolute top-full left-0 mt-2 w-full border rounded-xl shadow-2xl z-50 overflow-hidden ${pickerClass}`}>
                                            <div className={`p-3 border-b sticky top-0 z-10 ${isDark ? 'bg-[#1A1F2E] border-white/5' : 'bg-white border-slate-100'}`}>
                                                <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input type="text" autoFocus placeholder="Search..." className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none ${isDark ? 'bg-black/30 text-white' : 'bg-slate-100 text-slate-900'}`} value={iconSearch} onChange={(e) => setIconSearch(e.target.value)}/></div>
                                            </div>
                                            <div className="p-4 grid grid-cols-8 gap-2 max-h-60 overflow-y-auto">
                                                {filteredIcons.map(iconName => ( <button key={iconName} onClick={() => { setNewItem({...newItem, icon: iconName}); setIsIconPickerOpen(false); }} className={`p-3 rounded-lg flex items-center justify-center transition-all group hover:bg-black/5 ${newItem.icon === iconName ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400'}`} title={iconName}>{renderIcon(iconName)}</button> ))}
                                                {filteredIcons.length === 0 && <div className="col-span-8 text-center text-slate-500 py-4 text-xs">No icons found</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input type={field === 'value' || field === 'points' || field === 'threshold' ? 'number' : 'text'} className={inputClass} placeholder={`Enter ${field}...`} value={newItem[field] || ""} onChange={e => setNewItem({...newItem, [field]: e.target.value})} />
                            )}
                        </div>
                    ))}
                </div>
                <div className={`flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    {editingId && <button onClick={() => {setEditingId(null); setNewItem({}); setIsIconPickerOpen(false);}} className="px-6 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-bold transition-colors">Cancel</button>}
                    <button onClick={handleSave} className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-900/20 transition-all hover:-translate-y-1"><Save size={18}/> {editingId ? "Update Item" : "Save Item"}</button>
                </div>
            </div>
            {/* TABLE */}
            <div className={`rounded-2xl border overflow-hidden shadow-2xl ${cardClass}`}>
                <table className="w-full text-left">
                    <thead className={`text-xs uppercase font-bold ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}><tr>{fields.map(f => <th key={f} className="p-4">{f}</th>)}<th className="p-4 text-right">Actions</th></tr></thead>
                    <tbody className={`divide-y text-sm ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {items.length === 0 && <tr><td colSpan={fields.length + 1} className="p-12 text-center text-slate-500 italic">No items found. Add one above.</td></tr>}
                        {items.map(item => (
                            <tr key={item.id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                                {fields.map(f => (
                                    <td key={f} className={`p-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {f === 'color' ? (<div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_PALETTE.find(c => c.name === item[f])?.hex || item[f] }} /><span className="opacity-50 capitalize">{item[f]}</span></div>) : f === 'icon' ? (<div className="text-orange-400 bg-orange-400/10 w-8 h-8 rounded-lg flex items-center justify-center">{renderIcon(item[f])}</div>) : (<span className={f === 'value' || f === 'points' ? 'font-mono opacity-50' : ''}>{item[f]}</span>)}
                                    </td>
                                ))}
                                <td className="p-4 text-right"><div className="flex justify-end gap-2 opacity-50 hover:opacity-100 transition-opacity"><button onClick={() => handleEdit(item)} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"><Edit2 size={16}/></button><button onClick={() => handleDelete(item.id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"><Trash2 size={16}/></button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}