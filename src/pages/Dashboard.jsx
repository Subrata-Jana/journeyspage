import React, { useEffect, useState } from "react";
import {
  FileText, Image as ImageIcon, BarChart2, TrendingUp, Plus,
  Search, Settings, LogOut, Compass, Eye, Pencil, Trash2,
  Menu, X, Shield, Globe, Sun, Moon, MapPin, Gem,
  AlertCircle, Clock, RotateCcw, CheckCircle,
  Users, Zap, Share2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "../services/firebase";
import {
  collection, query, where, getDocs, getDoc, orderBy, limit, deleteDoc, doc, onSnapshot, updateDoc, increment
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

import Feed from "../components/Feed";
import { useGamification, RenderIcon } from "../hooks/useGamification";
import LevelBadge from "../components/premium/LevelBadge";
import LevelProgress from "../components/premium/LevelProgress";
import { processUserSession } from "../services/gamificationService";
import GiftOverlay from "../components/gamification/GiftOverlay";

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  

  // --- VIEW STATE ---
  const [currentView, setCurrentView] = useState("overview");
  const [stories, setStories] = useState([]); 
  const [loadingStories, setLoadingStories] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // --- REAL-TIME STATS STATE ---
  const [dashboardStats, setDashboardStats] = useState({
    totalStories: 0,
    totalLikes: 0,
    totalViews: 0,
    totalShares: 0,
    placesVisited: 0
  });

  // --- USER DATA ---
  const [userData, setUserData] = useState({ xp: 0, badges: [], inventory: [], name: "" });
  const [hubTab, setHubTab] = useState("tracking");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [siteLogo, setSiteLogo] = useState(null);

  // ⚡ GAMIFICATION ENGINE
  const { currentRank, badges, loot, loading: gameLoading } = useGamification(userData.xp, userData.badges, userData.inventory);

  // --- THEME & LOGO ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === "light" ? "dark" : "light"));

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "meta", "site_config"), snap => {
      if (snap.exists() && snap.data().logoUrl) setSiteLogo(snap.data().logoUrl);
    });
    return () => unsub();
  }, []);

  // 🚀 IGNITION: Check Daily Rewards & Clean Wallet on Load
  useEffect(() => {
    if (user?.uid) {
      processUserSession(user.uid);
    }
  }, [user]);

  // --- 1. USER SYNC & DAILY BONUS ---
  useEffect(() => {
    if (!user?.uid) return;
    const unsubUser = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);

        // Daily Bonus
        const today = new Date().toDateString();
        if (data.lastLogin !== today) {
            try {
                await updateDoc(doc(db, "users", user.uid), {
                    xp: increment(10),
                    lastLogin: today
                });
                toast.success("Daily Login Bonus: +10 XP!", { icon: "🌞" });
            } catch (e) { console.error(e); }
        }
      }
    });
    return () => unsubUser();
  }, [user]);

  // --- 2. CALCULATE ACCURATE STATS ---
  useEffect(() => {
    if (!user?.uid) return;

    const fetchStats = async () => {
      try {
        const q = query(collection(db, "stories"), where("authorId", "==", user.uid));
        const snap = await getDocs(q);
        
        let likes = 0;
        let views = 0;
        let shares = 0; 
        const uniquePlaces = new Set(); 

        snap.docs.forEach(doc => {
          const data = doc.data();

          // Handle Number vs Array for Likes/Shares
          const storyLikes = typeof data.likeCount === 'number' 
              ? data.likeCount : (Array.isArray(data.likes) ? data.likes.length : 0);
          likes += storyLikes;

          const storyShares = typeof data.shareCount === 'number' 
              ? data.shareCount : (Array.isArray(data.sharedBy) ? data.sharedBy.length : 0);
          shares += storyShares;

          views += (data.views || 0);

          if (data.locationData && data.locationData.value && data.locationData.value.place_id) {
            uniquePlaces.add(data.locationData.value.place_id);
          } else if (data.location) {
            uniquePlaces.add(data.location.trim().toLowerCase());
          }
        });
        
        setDashboardStats({
          totalStories: snap.size,
          totalLikes: likes,
          totalViews: views,
          totalShares: shares,
          placesVisited: uniquePlaces.size
        });

      } catch (error) { console.error("Stats error:", error); }
    };
    fetchStats();
  }, [user?.uid, stories]); 

  // --- 3. LOAD DISPLAY STORIES ---
  useEffect(() => {
    if (!user?.uid) return;
    const loadDisplayStories = async () => {
      setLoadingStories(true);
      if (currentView === "feed") {
        setStories([]); setLoadingStories(false); return;
      }
      try {
        const limitCount = currentView === "stories" ? 50 : 5;
        const q = query(
          collection(db, "stories"),
          where("authorId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );
        const snap = await getDocs(q);
        setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); } 
      finally { setLoadingStories(false); }
    };
    loadDisplayStories();
  }, [user?.uid, currentView]);

  const handleLogout = async (e) => {
    if(e) e.stopPropagation();
    try { await logout(); navigate("/login"); } 
    catch (error) { toast.error("Failed to log out"); }
  };

  const handleDeleteDraft = async (id, status, published) => {
    if (published && status !== "returned") return toast.error("Cannot delete published/pending stories.");
    if (!window.confirm("Delete this story permanently?")) return;
    const toastId = toast.loading("Deleting...");
    try {
      const storyRef = doc(db, "stories", id);
      const storySnap = await getDoc(storyRef);
      if (storySnap.exists()) {
        const data = storySnap.data();
        const imageRefs = [];
        if (data.coverImage) imageRefs.push(ref(storage, data.coverImage));
        if (Array.isArray(data.gallery)) {
          data.gallery.forEach(item => {
            const url = typeof item === "string" ? item : item.url;
            if (url) imageRefs.push(ref(storage, url));
          });
        }
        const daysSnap = await getDocs(collection(db, "stories", id, "days"));
        const deleteDaysPromises = daysSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteDaysPromises);
        await Promise.allSettled(imageRefs.map(deleteObject));
      }
      await deleteDoc(storyRef);
      setStories(prev => prev.filter(s => s.id !== id));
      toast.success("Deleted", { id: toastId });
    } catch (e) { toast.error("Delete failed", { id: toastId }); }
  };

  const filteredStories = stories.filter(story => {
    const matchesSearch = (story.title || "").toLowerCase().includes(searchQuery.toLowerCase());
    let matchesFilter = true;
    if (filterStatus === "published") matchesFilter = story.status === "approved";
    if (filterStatus === "draft") matchesFilter = !story.published;
    if (filterStatus === "review") matchesFilter = story.published && story.status !== "approved" && story.status !== "returned";
    if (filterStatus === "action") matchesFilter = story.status === "returned";
    return matchesSearch && matchesFilter;
  });

  if (loading || gameLoading) return <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white overflow-hidden font-sans transition-colors duration-300"> 
    <GiftOverlay />
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' } }} />

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#0B0F19]/95 backdrop-blur-2xl border-r border-slate-200 dark:border-white/5 p-6 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 px-2 relative">
          {siteLogo ? (<img src={siteLogo} alt="Logo" className={`h-12 w-auto object-contain transition-all duration-300 ${theme === 'light' ? 'invert brightness' : ''}`} />) : (<div className="relative w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-orange-500/20 border border-white/10"><Compass size={24} /></div>)}
          <div className="flex flex-col -space-y-0.5"><span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white leading-none">Journeys</span><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-[0.35em] uppercase leading-none ml-[1px]">Page</span></div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        <nav className="space-y-2 flex-1">
          <NavItem icon={<BarChart2 size={20}/>} label="Overview" active={currentView === 'overview'} onClick={() => setCurrentView('overview')} />
          <NavItem icon={<Globe size={20}/>} label="Travel Hub" active={currentView === 'feed'} onClick={() => setCurrentView('feed')} />
          <NavItem icon={<FileText size={20}/>} label="My Stories" active={currentView === 'stories'} onClick={() => setCurrentView('stories')} />
          
          {/* Settings Group */}
          <div className="mt-8 mb-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account</div>
          <NavItem icon={<Settings size={20}/>} label="Profile & Settings" onClick={() => navigate('/profile')} />
        </nav>

        {/* 👤 UPGRADED "PASSPORT" USER CARD (Vertical Layout) */}
        <div className="mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
          <div 
            className="group relative bg-slate-50 dark:bg-[#151b2b] p-4 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden cursor-pointer transition-all hover:border-orange-500/30 hover:shadow-lg"
            onClick={() => navigate('/profile')}
          >
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-opacity opacity-50 group-hover:opacity-100"/>
             
             <div className="flex items-center gap-3 mb-3">
                <div className="relative shrink-0">
                    <img src={userData.photoURL || `https://ui-avatars.com/api/?name=${userData.name || 'User'}`} className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-[#0B0F19] shadow-sm" alt="User" />
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#0B0F19] rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="font-bold text-slate-900 dark:text-white truncate text-base">{userData.name || "User"}</h4>
                   <div className="flex items-center gap-2 mt-0.5">
                       <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 uppercase tracking-wide">
                           {currentRank?.name || "Scout"}
                       </span>
                   </div>
                </div>
             </div>

             {/* Mini XP Bar */}
             <div className="mb-3">
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">
                    <span>Lvl {Math.floor((userData.xp || 0)/100) + 1}</span>
                    <span>{userData.xp} XP</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" 
                        style={{ width: `${Math.min((userData.xp % 100), 100)}%` }}
                    />
                </div>
             </div>

             {/* Logout Button */}
             <button 
                onClick={handleLogout} 
                className="w-full py-2 flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/20 transition-all"
             >
                <LogOut size={14}/> Sign Out
             </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto relative scroll-smooth bg-slate-50 dark:bg-[#0B0F19]">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white"><Menu size={20} /></button>
            <h1 className="text-xl font-semibold hidden sm:block capitalize bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                {currentView === 'overview' && 'Dashboard Overview'}
                {currentView === 'feed' && 'Travel Hub'} 
                {currentView === 'stories' && 'Your Journey Log'}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
              {/* 🌓 HEADER THEME TOGGLE */}
              <button 
                onClick={toggleTheme} 
                className="p-2.5 rounded-xl bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:text-orange-500 hover:border-orange-500/30 transition-all shadow-sm"
                title="Switch Theme"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button onClick={() => navigate("/create-story")} className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95">
                <Plus size={18} /> <span className="hidden sm:inline">New Journey</span>
              </button>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen">
          
          {currentView === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 1. PREMIUM HEADER */}
                <div className="relative rounded-[2.5rem] p-8 md:p-10 overflow-hidden shadow-2xl group border border-white/5 bg-[#0f111a]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/20 via-[#0B0F19] to-[#0B0F19] z-0"/>
                    <div className="relative z-10 flex flex-col xl:flex-row justify-between items-center gap-8">
                        <div className="flex flex-col sm:flex-row items-center gap-6 w-full xl:w-auto text-center sm:text-left">
                            <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-purple-600 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity animate-pulse-slow"/>
                                <div className="relative bg-[#0B0F19] rounded-full p-1 ring-4 ring-white/5"><LevelBadge rank={currentRank} size="xl" /></div>
                            </div>
                            <div className="flex-1 space-y-3">
                                <div>
                                    <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg">{currentRank?.name || "Novice"}</h2>
                                    <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-400 font-medium text-sm mt-1">
                                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] uppercase tracking-wider">Level {Math.floor((userData.xp || 0)/100) + 1}</span><span>•</span><span className="text-orange-400">{userData.xp || 0} Total XP</span>
                                    </div>
                                </div>
                                <div className="w-full sm:w-80 lg:w-96"><LevelProgress currentXP={userData.xp} rankData={currentRank} /></div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                            <div className="flex-1 sm:w-48 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col items-center justify-center hover:bg-white/10 transition-colors">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Latest Honors</span>
                                <div className="flex -space-x-3">
                                    {badges.filter(b => b.isUnlocked).length > 0 ? (
                                        badges.filter(b => b.isUnlocked).slice(0, 4).map((badge, idx) => (
                                            <div key={idx} title={badge.name} className="w-10 h-10 rounded-full bg-[#151b2b] border-2 border-slate-700 flex items-center justify-center text-lg shadow-lg relative z-10 hover:z-20 hover:scale-110 hover:-translate-y-1 transition-all cursor-help"><RenderIcon iconName={badge.icon} size={16} className="text-orange-400"/></div>
                                        ))
                                    ) : (<span className="text-xs text-slate-600 italic">No badges earned</span>)}
                                </div>
                            </div>
                            <div className="flex-1 sm:w-40 bg-gradient-to-b from-purple-500/10 to-blue-500/5 backdrop-blur-md rounded-2xl p-4 border border-purple-500/20 flex flex-col items-center justify-center relative overflow-hidden group/loot">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"/>
                                <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-1 z-10">Artifacts</span>
                                <div className="flex items-baseline gap-1 z-10"><span className="text-3xl font-black text-white">{loot.filter(l => l.isUnlocked).length}</span><span className="text-sm text-purple-400/60 font-bold">/{loot.length}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. STATS GRID */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    <StatCard title="Stories Written" value={dashboardStats.totalStories} icon={<FileText className="text-blue-500" />} />
                    <StatCard title="Places Visited" value={dashboardStats.placesVisited} icon={<MapPin className="text-emerald-500" />} />
                    <StatCard title="Total Likes" value={dashboardStats.totalLikes} icon={<TrendingUp className="text-pink-500" />} />
                    <StatCard title="Total Views" value={dashboardStats.totalViews} icon={<Eye className="text-purple-500" />} />
                    <StatCard title="Total Shares" value={dashboardStats.totalShares} icon={<Share2 className="text-orange-500" />} />
                </section>

                <section className="bg-white dark:bg-[#111625]/40 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"/> Recent Activity</div>
                    {stories.length === 0 ? <EmptyState /> : stories.slice(0,5).map(s => <StoryRow key={s.id} story={s} onDelete={handleDeleteDraft} navigate={navigate} />)}
                </section>
            </div>
          )}

          {currentView === 'feed' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="bg-white dark:bg-[#111625]/40 p-6 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Globe className="text-orange-500"/> Travel Hub</h2><p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Where all journeys connect.</p></div>
                        <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
                            <button onClick={() => setHubTab("tracking")} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${hubTab === "tracking" ? "bg-white dark:bg-[#0B0F19] text-orange-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"}`}><Users size={16}/> Tracking</button>
                            <button onClick={() => setHubTab("explore")} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${hubTab === "explore" ? "bg-white dark:bg-[#0B0F19] text-blue-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"}`}><Zap size={16}/> Explore</button>
                        </div>
                    </div>
                </div>
                <Feed activeTab={hubTab} />
             </div>
          )}

          {currentView === 'stories' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search your journeys..." className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:border-orange-500/50 outline-none transition-colors placeholder:text-slate-400" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                    <div className="flex bg-white dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5 self-start overflow-x-auto">{[{ id: 'all', label: 'All' }, { id: 'published', label: 'Published' }, { id: 'review', label: 'In Review' }, { id: 'action', label: 'Needs Action' }, { id: 'draft', label: 'Drafts' }].map(f => (<button key={f.id} onClick={() => setFilterStatus(f.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filterStatus === f.id ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>{f.label}</button>))}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredStories.map(story => (<StoryCard key={story.id} story={story} navigate={navigate} onDelete={handleDeleteDraft} />))}
                    {filteredStories.length === 0 && (<div className="col-span-full py-20 text-center text-slate-500">No stories found in this category.</div>)}
                </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Helpers
function NavItem({ icon, label, active, onClick }) { 
    return (
        <button onClick={onClick} className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"}`}>
            {icon} <span className="text-sm font-medium">{label}</span>
        </button>
    ); 
}

function StatCard({ title, value, icon }) { 
    return (
        <div className="bg-white dark:bg-[#111625]/60 p-6 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm group hover:border-orange-500/20 transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{title}</div>
        </div>
    ); 
}

const formatStoryDate = (story) => {
    if (story.createdAt?.seconds) {
        return new Date(story.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return story.month || "Unknown Date";
};

const getStatusConfig = (story) => { 
    if (story.status === 'returned') return { label: "NEEDS REVISION", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: <RotateCcw size={10} strokeWidth={3}/>, canEdit: true }; 
    if (story.status === 'approved') return { label: "PUBLISHED", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: <CheckCircle size={10} strokeWidth={3}/>, canEdit: false }; 
    if (story.published) return { label: "IN REVIEW", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: <Clock size={10} strokeWidth={3}/>, canEdit: false }; 
    return { label: "DRAFT", color: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/20", icon: <FileText size={10} strokeWidth={3}/>, canEdit: true }; 
};

function StoryRow({ story, navigate, onDelete }) { 
    const status = getStatusConfig(story); 
    const displayDate = formatStoryDate(story); 

    return (
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group last:border-0">
            <div>
                <div className="font-medium text-slate-900 dark:text-white group-hover:text-orange-500 cursor-pointer transition-colors" onClick={() => navigate(`/story/${story.id}`)}>{story.title || "Untitled"}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Compass size={10}/> {story.location || "No Location"} 
                    <span className="w-0.5 h-0.5 rounded-full bg-slate-400"/>
                    {displayDate}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded border ${status.color}`}>{status.icon} {status.label}</span>
                {status.canEdit && (<button onClick={() => navigate(`/create-story?edit=${story.id}`)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"><Pencil size={16}/></button>)}
            </div>
        </div>
    ) 
}

function StoryCard({ story, navigate, onDelete }) { 
    const status = getStatusConfig(story); 
    const displayDate = formatStoryDate(story);

    return (
        <div className={`group relative flex flex-col bg-white dark:bg-[#111625]/40 border rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${story.status === 'returned' ? 'border-red-500/50 shadow-red-500/10' : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30'}`}>
            <div className="h-48 bg-slate-100 dark:bg-slate-800 relative overflow-hidden shrink-0">
                {story.coverImage ? (<img src={story.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Cover" />) : (<div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={32}/></div>)}
                <div className="absolute top-3 right-3"><span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md border ${status.color}`}>{status.icon} {status.label}</span></div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 truncate">{story.title || "Untitled Journey"}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <Compass size={12}/> {story.location || "Unknown"} <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"/> {displayDate}
                </div>
                {story.status === 'returned' && story.adminNotes && (<div className="mb-4 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-xs"><div className="flex items-center gap-1.5 text-red-500 font-bold mb-1"><AlertCircle size={12}/> Needs Attention:</div><p className="text-slate-600 dark:text-slate-300 leading-snug">{story.adminNotes}</p></div>)}
                <div className="mt-auto flex items-center justify-between border-t border-slate-200 dark:border-white/5 pt-4">
                    <button onClick={() => navigate(`/story/${story.id}`)} className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"><Eye size={14}/> View</button>
                    <div className="flex gap-1">{status.canEdit && (<><button onClick={() => navigate(`/create-story?edit=${story.id}`)} className={`p-2 rounded-lg transition-colors ${story.status === 'returned' ? 'text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse' : 'text-blue-500 hover:bg-blue-500/10'}`} title="Edit Story"><Pencil size={14}/></button><button onClick={() => onDelete(story.id, story.status, story.published)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Story"><Trash2 size={14}/></button></>)}</div>
                </div>
            </div>
        </div>
    ) 
}

function EmptyState() { return <div className="p-10 text-center text-slate-500 italic">No recent activity. Start a new journey!</div> }