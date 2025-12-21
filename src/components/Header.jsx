import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, LogOut, User, LayoutDashboard, Compass, 
  Menu, X, ChevronDown, PlusCircle, Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import Modal from "./ui/Modal";
import toast from "react-hot-toast"; // Ensure you import toast for feedback

export default function Header() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  // --- 1. DARK MODE (Fixed for Tailwind v4) ---
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

  // --- 3. DYNAMIC STYLES ---
  const navBackground = scrolled 
    ? "bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-white/5 shadow-sm" 
    : "bg-transparent border-transparent";

  const textColor = scrolled
    ? "text-slate-800 dark:text-white"
    : "text-white drop-shadow-md"; 

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // --- 🔴 REVISED LOGOUT FUNCTION ---
  async function handleLogout() {
    try {
      await logout();
      setLogoutOpen(false);
      setMenuOpen(false); // Close other menus too
      setMobileMenuOpen(false);
      toast.success("Logged out successfully"); // Add feedback
      navigate("/login"); // Force redirect
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
          
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
                <div className="absolute inset-0 bg-orange-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-xl text-white shadow-lg">
                    <Compass size={24} />
                </div>
            </div>
            <span className={`font-bold text-xl tracking-tight transition-colors duration-300 ${textColor}`}>
                Journeys<span className="text-orange-500">Page</span>
            </span>
          </Link>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center gap-6">
            {!user ? (
              <>
                <Link to="/login" className={`text-sm font-medium transition-colors hover:text-orange-500 ${textColor}`}>
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-white text-slate-900 px-6 py-2.5 text-sm font-bold hover:bg-slate-100 transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform duration-200"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <div className={`flex items-center gap-6 text-sm font-medium transition-colors duration-300 ${textColor}`}>
                    <Link to="/dashboard" className="hover:text-orange-500 transition flex items-center gap-2">
                        <LayoutDashboard size={18}/> Dashboard
                    </Link>
                    <Link to="/create-story" className="hover:text-orange-500 transition flex items-center gap-2">
                        <PlusCircle size={18}/> Create
                    </Link>
                </div>

                <div className={`h-6 w-px transition-colors duration-300 ${scrolled ? 'bg-slate-300 dark:bg-white/20' : 'bg-white/30'}`} />

                <button 
                    onClick={toggleTheme}
                    className={`p-2 rounded-full transition-colors duration-300 ${textColor} hover:bg-white/20`}
                >
                    {dark ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* USER DROPDOWN */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className={`flex items-center gap-3 pl-1 pr-3 py-1 rounded-full border transition-all duration-300 ${
                        scrolled 
                        ? 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-orange-500/50' 
                        : 'border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white/20'
                    }`}
                  >
                    <img
                      src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.name || 'User'}`}
                      className="h-8 w-8 rounded-full object-cover border border-white/10"
                      alt="Profile"
                    />
                    <ChevronDown size={14} className={`transition-transform duration-300 ${textColor} ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-64 rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-[#111625] shadow-2xl overflow-hidden ring-1 ring-black/5 origin-top-right text-left z-50"
                      >
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                             {userProfile?.name || "Explorer"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded border border-orange-500/20">
                                <Shield size={10} /> Lvl {userProfile?.level || 1}
                             </span>
                          </div>
                        </div>
                        <div className="p-2 space-y-1">
                            <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition">
                                <User size={16} /> Profile Settings
                            </Link>
                            <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition">
                                <LayoutDashboard size={16} /> Dashboard
                            </Link>
                        </div>
                        <div className="p-2 border-t border-slate-100 dark:border-white/5">
                            <button onClick={() => { setMenuOpen(false); setLogoutOpen(true); }} className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </nav>

          {/* MOBILE TOGGLE */}
          <div className="md:hidden flex items-center gap-4">
              <button onClick={toggleTheme} className={`transition-colors duration-300 ${textColor}`}>
                 {dark ? <Sun size={20}/> : <Moon size={20}/>}
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`transition-colors duration-300 ${textColor}`}>
                  {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
          </div>
        </div>
        
        {/* MOBILE MENU */}
        <AnimatePresence>
            {mobileMenuOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="md:hidden overflow-hidden bg-white dark:bg-[#0B0F19] border-b border-slate-200 dark:border-white/5 shadow-xl"
                >
                    <div className="px-6 py-6 space-y-6">
                        {user ? (
                            <>
                                <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                                    <img src={userProfile?.photoURL} className="w-12 h-12 rounded-full border border-slate-200 dark:border-white/10" alt="User"/>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white">{userProfile?.name}</div>
                                        <div className="text-xs text-slate-500">{userProfile?.email}</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-100 dark:border-white/5">Dashboard</Link>
                                    <Link to="/create-story" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-100 dark:border-white/5">Create Story</Link>
                                    <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-100 dark:border-white/5">Profile Settings</Link>
                                    <button onClick={() => { setMobileMenuOpen(false); setLogoutOpen(true); }} className="block w-full text-left py-3 text-red-500 font-medium">Log Out</button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-center py-3 text-slate-600 dark:text-slate-300 font-medium border rounded-xl border-slate-200 dark:border-white/10">Log In</Link>
                                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="text-center py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg">Get Started</Link>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </header>

      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)}>
        <div className="p-4 text-center">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sign out?</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Are you sure you want to log out?</p>
            <div className="mt-8 flex gap-3">
                <button onClick={() => setLogoutOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-xl">Cancel</button>
                <button onClick={handleLogout} className="flex-1 px-4 py-3 text-sm font-bold bg-red-500 text-white rounded-xl shadow-lg">Confirm</button>
            </div>
        </div>
      </Modal>
    </>
  );
}