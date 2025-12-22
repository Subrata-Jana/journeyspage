import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, LogOut, User, LayoutDashboard, Compass, 
  Menu, X, ChevronDown, PlusCircle, Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore"; 
import { db } from "../services/firebase"; 
import { useAuth } from "../contexts/AuthContext";
import Modal from "./ui/Modal";
import toast from "react-hot-toast"; 

export default function Header() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  // --- 1. DARK MODE ---
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" || 
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  function toggleTheme() {
    setDark(!dark);
  }

  // --- 2. SCROLL LOGIC ---
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // --- 3. FETCH SITE LOGO ---
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

  // --- 4. DYNAMIC STYLES (PREMIUM SHADOW ADDED) ---
  const navBackground = scrolled 
    ? "bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 shadow-sm" 
    : "bg-transparent border-transparent py-6"; // Added extra padding when top for grandeur

  // ⚡⚡⚡ PREMIUM SHADOW LOGIC HERE ⚡⚡⚡
  const textColor = scrolled
    ? "text-slate-900 dark:text-white transition-all" // Clean look when scrolled on solid bg
    // When at the top, use a multi-layered arbitrary text-shadow for premium depth
    : "text-white [text-shadow:_0_2px_4px_rgb(0_0_0_/_50%),_0_10px_20px_rgb(0_0_0_/_30%)] transition-all"; 

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
      setLogoutOpen(false);
      setMenuOpen(false); 
      setMobileMenuOpen(false);
      toast.success("Logged out successfully"); 
      navigate("/login"); 
    } catch (error) {
      console.error("Logout failed", error);
      toast.error("Failed to log out");
    }
  }

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out py-4 ${navBackground}`}
      >
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          
          {/* LOGO & TEXT SECTION */}
          <Link to="/" className="flex items-center gap-3 group">
            {/* A. The Image or Icon */}
            {siteLogo ? (
                <img 
                    src={siteLogo} 
                    alt="Logo" 
                    // Added a subtle drop-shadow to the image itself when at the top
                    className={`h-16 w-auto object-contain transition-transform duration-500 group-hover:scale-105 ${!scrolled ? 'drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]' : ''}`} 
                />
            ) : (
                <div className="relative">
                    <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className={`relative bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-2xl text-white shadow-xl transition-all duration-500 ${!scrolled ? 'scale-110' : 'scale-100'}`}>
                        <Compass size={24} />
                    </div>
                </div>
            )}

            {/* B. The Text with Premium Shadow */}
            <span className={`font-extrabold text-2xl tracking-tight ${textColor}`}>
                Journeys<span className="text-orange-500">Page</span>
            </span>
          </Link>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center gap-8">
            {!user ? (
              <>
                <Link to="/login" className={`text-sm font-bold tracking-wide transition-all hover:text-orange-500 ${textColor}`}>
                  LOGIN
                </Link>
                <Link
                  to="/register"
                  className={`rounded-full px-7 py-3 text-sm font-bold transition-all shadow-lg hover:shadow-orange-500/30 hover:-translate-y-1 duration-300
                    ${scrolled ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-orange-600 dark:hover:bg-orange-500 dark:hover:text-white' : 'bg-white text-slate-900 hover:bg-orange-500 hover:text-white'}
                  `}
                >
                  GET STARTED
                </Link>
              </>
            ) : (
              <>
                {/* Added extra gap and bold font for premium feel */}
                <div className={`flex items-center gap-8 text-sm font-bold tracking-wide transition-colors duration-300 ${textColor}`}>
                    <Link to="/dashboard" className="hover:text-orange-500 transition-all flex items-center gap-2 hover:-translate-y-0.5">
                        <LayoutDashboard size={18} className="opacity-80"/> DASHBOARD
                    </Link>
                    <Link to="/create-story" className="hover:text-orange-500 transition-all flex items-center gap-2 hover:-translate-y-0.5">
                        <PlusCircle size={18} className="opacity-80"/> CREATE
                    </Link>
                </div>

                <div className={`h-8 w-px transition-colors duration-300 ${scrolled ? 'bg-slate-300 dark:bg-white/20' : 'bg-white/40'}`} />

                <button 
                    onClick={toggleTheme}
                    className={`p-2.5 rounded-full transition-all duration-300 ${textColor} hover:bg-white/20 dark:hover:bg-white/10 hover:rotate-12`}
                >
                    {dark ? <Sun size={22} /> : <Moon size={22} />}
                </button>

                {/* USER DROPDOWN */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className={`flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full border-2 transition-all duration-300 ${
                        scrolled 
                        ? 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 hover:border-orange-500/50' 
                        : 'border-white/30 bg-white/10 backdrop-blur-xl text-white hover:bg-white/20 hover:border-white/50'
                    }`}
                  >
                    <img
                      src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.name || 'User'}`}
                      className="h-9 w-9 rounded-full object-cover border-2 border-white/20"
                      alt="Profile"
                    />
                    <ChevronDown size={16} className={`transition-transform duration-300 opacity-80 ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(8px)" }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-4 w-72 rounded-3xl border border-slate-100 dark:border-white/10 bg-white/80 dark:bg-[#111625]/90 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-black/5 origin-top-right text-left z-50"
                      >
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-gradient-to-br from-slate-50 to-white dark:from-white/5 dark:to-transparent">
                          <p className="text-lg font-black text-slate-900 dark:text-white truncate leading-tight">
                             {userProfile?.name || "Explorer"}
                          </p>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mb-3">
                             {userProfile?.email}
                          </p>
                          <div className="flex items-center gap-2">
                             <span className="flex items-center gap-1.5 text-xs font-extrabold bg-gradient-to-r from-orange-500 to-red-500 text-white px-2.5 py-1 rounded-full shadow-sm">
                                <Shield size={12} /> Lvl {userProfile?.level || 1}
                             </span>
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                            <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                <User size={18} className="text-slate-400 dark:text-slate-500"/> Profile Settings
                            </Link>
                            <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                <LayoutDashboard size={18} className="text-slate-400 dark:text-slate-500" /> Dashboard
                            </Link>
                        </div>
                        <div className="p-3 border-t border-slate-100 dark:border-white/5">
                            <button onClick={() => { setMenuOpen(false); setLogoutOpen(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-500 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                                <LogOut size={18} /> Sign Out
                            </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </nav>

          {/* MOBILE TOGGLE (Updated styles) */}
          <div className="md:hidden flex items-center gap-5">
              <button onClick={toggleTheme} className={`transition-all duration-300 hover:rotate-12 ${textColor}`}>
                 {dark ? <Sun size={24}/> : <Moon size={24}/>}
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`transition-all duration-300 hover:scale-110 ${textColor}`}>
                  {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
          </div>
        </div>
        
        {/* MOBILE MENU (Kept mostly same, just ensuring dark mode support) */}
        <AnimatePresence>
            {mobileMenuOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="md:hidden overflow-hidden bg-white/90 dark:bg-[#0B0F19]/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 shadow-2xl"
                >
                    <div className="px-6 py-8 space-y-6">
                        {user ? (
                            <>
                                <div className="flex items-center gap-4 pb-6 border-b border-slate-100 dark:border-white/5">
                                    <img src={userProfile?.photoURL} className="w-14 h-14 rounded-full border-2 border-slate-200 dark:border-white/10 shadow-md" alt="User"/>
                                    <div>
                                        <div className="font-black text-xl text-slate-900 dark:text-white">{userProfile?.name}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">{userProfile?.email}</div>
                                    </div>
                                </div>
                                <div className="space-y-2 font-bold tracking-wide">
                                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-4 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-white/5 hover:text-orange-500"><LayoutDashboard size={20}/> Dashboard</Link>
                                    <Link to="/create-story" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-4 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-white/5 hover:text-orange-500"><PlusCircle size={20}/> Create Story</Link>
                                    <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-4 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-white/5 hover:text-orange-500"><User size={20}/> Profile Settings</Link>
                                    <button onClick={() => { setMobileMenuOpen(false); setLogoutOpen(true); }} className="flex items-center gap-3 w-full text-left py-4 text-red-500 hover:text-red-600"><LogOut size={20}/> Log Out</button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-4 font-bold tracking-wide">
                                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-center py-4 text-slate-700 dark:text-slate-300 border-2 rounded-2xl border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">LOG IN</Link>
                                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="text-center py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl shadow-lg hover:shadow-orange-500/30 transition-all">GET STARTED</Link>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </header>

      {/* MODAL (Minor style tweaks for consistency) */}
      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)}>
        <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut size={32}/>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Sign out?</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-base font-medium">Are you sure you want to log out of your account?</p>
            <div className="mt-8 flex gap-4">
                <button onClick={() => setLogoutOpen(false)} className="flex-1 px-6 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all">Cancel</button>
                <button onClick={handleLogout} className="flex-1 px-6 py-3.5 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-lg hover:shadow-red-500/30 transition-all">Confirm Sign Out</button>
            </div>
        </div>
      </Modal>
    </>
  );
}