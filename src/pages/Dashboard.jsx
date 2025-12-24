import React, { useEffect, useState } from "react";
import {
  FileText, Image as ImageIcon, BarChart2, TrendingUp, Plus,
  Search, Settings, LogOut, Compass, Eye, Pencil, Trash2,
  Menu, X, Shield, Sparkles, Globe, Sun, Moon, MapPin, Gem,
  AlertCircle, Clock, RotateCcw, CheckCircle,
  Users, Zap // ⚡ Icons for Travel Hub Tabs
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';

import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "../services/firebase";
import {
  collection, query, where, getDocs, getDoc, orderBy, limit, deleteDoc, doc, onSnapshot
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

// IMPORT THE FEED COMPONENT
import Feed from "../components/Feed"; 

export default function Dashboard() {
  const { user, userProfile, logout, loading } = useAuth();
  const navigate = useNavigate();

  // --- VIEW STATE ---
  const [currentView, setCurrentView] = useState("overview"); 
  const [stories, setStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // --- TRAVEL HUB STATE ---
  const [hubTab, setHubTab] = useState("tracking"); // 'tracking' | 'explore'

  // --- SEARCH & FILTER ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); 

  // --- THEME STATE ---
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // --- ⚡ FETCH SITE LOGO ---
  const [siteLogo, setSiteLogo] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "meta", "site_config"), (doc) => {
      if (doc.exists() && doc.data().logoUrl) {
        setSiteLogo(doc.data().logoUrl);
      } else {
        setSiteLogo(null);
      }
    });
    return () => unsub();
  }, []);

  // --- ONBOARDING CHECK ---
  useEffect(() => {
    if (!loading && userProfile && userProfile.onboarded !== true) {
      navigate("/onboarding", { replace: true });
    }
  }, [userProfile, loading, navigate]);

  // --- LOAD STORIES ---
  useEffect(() => {
    if (!user?.uid) return;
    const loadStories = async () => {
      try {
        if (currentView === 'feed') return; 
        const limitCount = currentView === 'stories' ? 50 : 5;
        const q = query(
          collection(db, "stories"),
          where("authorId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );
        const snap = await getDocs(q);
        setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStories(false);
      }
    };
    loadStories();
  }, [user, currentView]);

  // --- LOGOUT ---
  const handleLogout = async () => {
    try {
        await logout();
        navigate("/login"); 
    } catch (error) {
        console.error("Logout failed", error);
        toast.error("Failed to log out");
    }
  };

  // --- DELETE STORY ---
  const handleDeleteDraft = async (id, status, published) => {
    // 🛡️ SECURITY CHECK: Prevent deletion if Pending or Approved
    if (published && status !== 'returned') {
        return toast.error("Cannot delete a story while it is under review or approved.");
    }

    if (!window.confirm(`Delete this story permanently?`)) return;
    const toastId = toast.loading("Deleting...");
    try {
      const storyRef = doc(db, "stories", id);
      const storySnap = await getDoc(storyRef);
      if (storySnap.exists()) {
        const data = storySnap.data();
        const imageRefs = [];
        if (data.coverImage) try { imageRefs.push(ref(storage, data.coverImage)); } catch(e){}
        if (data.gallery && Array.isArray(data.gallery)) {
          data.gallery.forEach(item => {
            const url = typeof item === 'string' ? item : item.url;
            if (url) try { imageRefs.push(ref(storage, url)); } catch(e){}
          });
        }
        const daysRef = collection(db, "stories", id, "days");
        const daysSnap = await getDocs(daysRef);
        const deleteDaysPromises = [];
        daysSnap.forEach(dayDoc => {
           const dayData = dayDoc.data();
           if (dayData.imageUrl) try { imageRefs.push(ref(storage, dayData.imageUrl)); } catch(e){}
           deleteDaysPromises.push(deleteDoc(dayDoc.ref));
        });
        await Promise.allSettled(imageRefs.map(imgRef => deleteObject(imgRef)));
        await Promise.all(deleteDaysPromises);
      }
      await deleteDoc(storyRef);
      setStories(prev => prev.filter(s => s.id !== id));
      toast.success("Deleted", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Delete failed", { id: toastId });
    }
  };

  const filteredStories = stories.filter(story => {
    const matchesSearch = (story.title || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    // Updated Filter Logic
    let matchesFilter = true;
    if (filterStatus === "published") matchesFilter = story.status === 'approved';
    if (filterStatus === "draft") matchesFilter = !story.published;
    if (filterStatus === "review") matchesFilter = story.published && story.status !== 'approved' && story.status !== 'returned';
    if (filterStatus === "action") matchesFilter = story.status === 'returned';

    return matchesSearch && matchesFilter;
  });

  if (loading || !userProfile) return <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white overflow-hidden font-sans transition-colors duration-300">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' } }} />

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#0B0F19]/95 backdrop-blur-2xl border-r border-slate-200 dark:border-white/5 p-6 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* ⚡ LOGO SECTION */}
        <div className="flex items-center gap-3 mb-12 px-2 relative">
          {siteLogo ? (
              <img 
                  src={siteLogo} 
                  alt="Logo" 
                  className={`h-12 w-auto object-contain transition-all duration-300 ${theme === 'light' ? 'invert brightness' : ''}`} 
              />
          ) : (
              <div className="relative w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-orange-500/20 border border-white/10">
                <Compass size={24} />
              </div>
          )}
          
          <div className="flex flex-col -space-y-0.5">
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white leading-none">Journeys</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-[0.35em] uppercase leading-none ml-[1px]">Page</span>
          </div>
          
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        {/* Navigation */}
        <nav className="space-y-2 flex-1">
          <NavItem icon={<BarChart2 size={20}/>} label="Overview" active={currentView === 'overview'} onClick={() => setCurrentView('overview')} />
          {/* ⚡ UPDATED TO TRAVEL HUB */}
          <NavItem icon={<Globe size={20}/>} label="Travel Hub" active={currentView === 'feed'} onClick={() => setCurrentView('feed')} />
          <NavItem icon={<FileText size={20}/>} label="My Stories" active={currentView === 'stories'} onClick={() => setCurrentView('stories')} />
          
          {/* THEME TOGGLE & SETTINGS */}
          <div className="pt-8 pb-4 flex items-center justify-between px-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Settings</span>
              <button 
                onClick={toggleTheme}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-orange-500 transition-colors"
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
          </div>

          <NavItem icon={<Settings size={20}/>} label="Profile & Settings" onClick={() => navigate('/profile')} />
          
          <button 
            onClick={handleLogout}
            className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-red-500 hover:bg-red-500/10 hover:text-red-600 border border-transparent mt-2"
          >
            <LogOut size={20} /> <span className="text-sm font-medium">Log Out</span>
          </button>
        </nav>

        {/* User Card */}
        <div className="mt-auto relative group">
          <div 
            className="relative flex flex-col bg-slate-50 dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 overflow-hidden cursor-pointer hover:border-orange-500/30 transition-all duration-300"
            onClick={() => navigate('/profile')}
          >
             <div className="flex items-center gap-4">
                <div className="relative">
                   <div className="relative w-10 h-10 rounded-full bg-slate-200 dark:bg-[#0B0F19]">
                      <img 
                        src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.name || 'User'}`} 
                        className="w-full h-full rounded-full object-cover" 
                        alt="User"
                      />
                   </div>
                   <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#0B0F19] rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                     {userProfile?.name || "User"}
                   </h4>
                   <p className="text-[10px] text-slate-500 truncate">View Profile</p>
                </div>
             </div>
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
          <button onClick={() => navigate("/create-story")} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95">
            <Plus size={16} /> <span className="hidden sm:inline">New Journey</span>
          </button>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen">
          
          {/* VIEW 1: OVERVIEW */}
          {currentView === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. GAMIFICATION HEADER */}
                <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
                              <Shield size={32} className="text-white" />
                           </div>
                           <div>
                              <h2 className="text-2xl font-bold">
                                  {userProfile?.rankName || "Novice Explorer"}
                              </h2>
                              <p className="text-white/80 text-sm font-medium flex items-center gap-2">
                                  Level {userProfile?.level || 1} • {userProfile?.points || 0} Points
                              </p>
                           </div>
                        </div>
                        
                        {/* RIGHT SIDE: Badges & Hidden Treasures */}
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-3">
                                {userProfile?.badges && userProfile.badges.length > 0 ? (
                                    userProfile.badges.slice(0, 5).map((badge, idx) => (
                                        <div key={idx} title={badge.name} className="w-10 h-10 rounded-full bg-slate-900/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-lg shadow-sm">
                                            {badge.icon || "🏆"}
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-3 py-1 rounded-full bg-black/20 text-xs">No badges yet</div>
                                )}
                            </div>

                            <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-black/20 backdrop-blur-sm border border-white/10">
                                <Gem size={20} className="text-purple-200 mb-1" />
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Treasures</span>
                                <span className="text-xs font-bold">{userProfile?.hiddenTreasures?.length || 0}/9</span>
                            </div>
                        </div>
                    </div>
                    <div className="absolute -right-10 -bottom-10 opacity-10"><Compass size={200}/></div>
                </div>

                {/* 2. STATS GRID */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Stories Written" value={stories.length} icon={<FileText className="text-blue-500" />} />
                    <StatCard title="Places Visited" value={userProfile?.placesVisited || 0} icon={<MapPin className="text-emerald-500" />} />
                    <StatCard title="Total Likes" value={stories.reduce((a, b) => a + (b.likes || 0), 0)} icon={<TrendingUp className="text-pink-500" />} />
                    <StatCard title="Total Views" value={stories.reduce((a, b) => a + (b.views || 0), 0)} icon={<Eye className="text-purple-500" />} />
                </section>

                {/* 3. RECENT ACTIVITY */}
                <section className="bg-white dark:bg-[#111625]/40 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"/> Recent Activity
                    </div>
                    {stories.length === 0 ? <EmptyState /> : stories.slice(0,5).map(s => <StoryRow key={s.id} story={s} onDelete={handleDeleteDraft} navigate={navigate} />)}
                </section>
            </div>
          )}

          {/* VIEW 2: TRAVEL HUB (Formerly Community Feed) */}
          {currentView === 'feed' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                
                {/* ⚡ HUB HEADER & TABS */}
                <div className="bg-white dark:bg-[#111625]/40 p-6 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Globe className="text-orange-500"/> Travel Hub
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Where all journeys connect.
                            </p>
                        </div>
                        
                        {/* TAB SWITCHER */}
                        <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
                            <button 
                                onClick={() => setHubTab("tracking")}
                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${hubTab === "tracking" ? "bg-white dark:bg-[#0B0F19] text-orange-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"}`}
                            >
                                <Users size={16}/> Tracking
                            </button>
                            <button 
                                onClick={() => setHubTab("explore")}
                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${hubTab === "explore" ? "bg-white dark:bg-[#0B0F19] text-blue-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"}`}
                            >
                                <Zap size={16}/> Explore
                            </button>
                        </div>
                    </div>
                </div>

                {/* ⚡ PASS THE TAB STATE TO FEED COMPONENT */}
                <Feed activeTab={hubTab} />
             </div>
          )}

          {/* VIEW 3: MY STORIES */}
          {currentView === 'stories' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search your journeys..." 
                            className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:border-orange-500/50 outline-none transition-colors placeholder:text-slate-400"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-white dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5 self-start overflow-x-auto">
                        {[
                           { id: 'all', label: 'All' },
                           { id: 'published', label: 'Published' },
                           { id: 'review', label: 'In Review' },
                           { id: 'action', label: 'Needs Action' },
                           { id: 'draft', label: 'Drafts' }
                        ].map(f => (
                            <button 
                                key={f.id}
                                onClick={() => setFilterStatus(f.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filterStatus === f.id ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredStories.map(story => (
                        <StoryCard key={story.id} story={story} navigate={navigate} onDelete={handleDeleteDraft} />
                    ))}
                    {filteredStories.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-500">No stories found in this category.</div>
                    )}
                </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// Helpers...
function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"}`}>
      {icon} <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white dark:bg-[#111625]/60 p-6 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm">
      <div className="flex justify-between items-start mb-4"><div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg">{icon}</div></div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
      <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{title}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 💡 HELPER: GET STATUS CONFIG
// ----------------------------------------------------------------------
const getStatusConfig = (story) => {
    if (story.status === 'returned') return { 
        label: "NEEDS REVISION", 
        color: "bg-red-500/10 text-red-500 border-red-500/20", 
        icon: <RotateCcw size={10} strokeWidth={3}/>,
        canEdit: true
    };
    if (story.status === 'approved') return { 
        label: "PUBLISHED", 
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", 
        icon: <CheckCircle size={10} strokeWidth={3}/>,
        canEdit: false // ⚡ LOCKED
    };
    if (story.published) return { 
        label: "IN REVIEW", 
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20", 
        icon: <Clock size={10} strokeWidth={3}/>,
        canEdit: false // ⚡ LOCKED
    };
    return { 
        label: "DRAFT", 
        color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", 
        icon: <FileText size={10} strokeWidth={3}/>,
        canEdit: true
    };
};

function StoryRow({ story, navigate, onDelete }) {
  const status = getStatusConfig(story);
  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group last:border-0">
      <div>
        <div className="font-medium text-slate-900 dark:text-white group-hover:text-orange-500 cursor-pointer transition-colors" onClick={() => navigate(`/story/${story.id}`)}>{story.title || "Untitled"}</div>
        <div className="text-xs text-slate-500 mt-0.5">{story.location || "No Location"} • {story.month || "No Date"}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded border ${status.color}`}>
            {status.icon} {status.label}
        </span>
        {/* ⚡ CONDITIONAL EDIT BUTTON */}
        {status.canEdit && (
            <button onClick={() => navigate(`/create-story?edit=${story.id}`)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"><Pencil size={16}/></button>
        )}
      </div>
    </div>
  )
}

function StoryCard({ story, navigate, onDelete }) {
    const status = getStatusConfig(story);
    
    return (
        <div className={`group relative flex flex-col bg-white dark:bg-[#111625]/40 border rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl
            ${story.status === 'returned' ? 'border-red-500/50 shadow-red-500/10' : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30'}
        `}>
            {/* COVER IMAGE */}
            <div className="h-48 bg-slate-100 dark:bg-slate-800 relative overflow-hidden shrink-0">
                {story.coverImage ? (
                    <img src={story.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={32}/></div>
                )}
                <div className="absolute top-3 right-3">
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md border ${status.color}`}>
                        {status.icon} {status.label}
                    </span>
                </div>
            </div>

            {/* CARD CONTENT */}
            <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 truncate">{story.title || "Untitled Journey"}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <Compass size={12}/> {story.location || "Unknown"} 
                    <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"/> 
                    {story.month}
                </div>

                {/* 🔴 ADMIN NOTE ALERT */}
                {story.status === 'returned' && story.adminNotes && (
                    <div className="mb-4 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-xs">
                        <div className="flex items-center gap-1.5 text-red-500 font-bold mb-1">
                            <AlertCircle size={12}/> Needs Attention:
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-snug">{story.adminNotes}</p>
                    </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-slate-200 dark:border-white/5 pt-4">
                    <button onClick={() => navigate(`/story/${story.id}`)} className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"><Eye size={14}/> View</button>
                    
                    <div className="flex gap-1">
                        {/* ⚡ CONDITIONAL EDIT ACTIONS */}
                        {status.canEdit && (
                            <>
                                <button 
                                    onClick={() => navigate(`/create-story?edit=${story.id}`)} 
                                    className={`p-2 rounded-lg transition-colors ${story.status === 'returned' ? 'text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse' : 'text-blue-500 hover:bg-blue-500/10'}`}
                                    title="Edit Story"
                                >
                                    <Pencil size={14}/>
                                </button>
                                <button 
                                    onClick={() => onDelete(story.id, story.status, story.published)} 
                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete Story"
                                >
                                    <Trash2 size={14}/>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function EmptyState() {
    return <div className="p-10 text-center text-slate-500 italic">No recent activity. Start a new journey!</div>
}