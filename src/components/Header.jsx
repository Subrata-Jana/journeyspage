import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PlusCircle,
  Shield,
  Sun,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "./ui/Modal";
import { isReviewStaff } from "../utils/admin";
import { getProfilePhotoUrl } from "../utils/userProfile";
import NotificationBell from "./NotificationBell";

const publicLinks = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export default function Header() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canReceiveReviewNotifications = isReviewStaff(user, userProfile);
  const isHome = location.pathname === "/";

  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });
  const [scrolled, setScrolled] = useState(false);
  const [siteLogo, setSiteLogo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "meta", "site_config"), (docSnap) => {
      setSiteLogo(docSnap.exists() && docSnap.data().logoUrl ? docSnap.data().logoUrl : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    try {
      await logout();
      setLogoutOpen(false);
      setMenuOpen(false);
      setMobileMenuOpen(false);
      toast.success("Logged out successfully");
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed", error);
      toast.error("Failed to log out");
    }
  }

  const transparent = isHome && !scrolled && !mobileMenuOpen;
  const headerSurface = transparent
    ? "border-white/15 bg-black/20 text-white backdrop-blur-md"
    : "border-slate-200/80 bg-white/95 text-slate-950 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0F19]/95 dark:text-white";
  const mutedText = transparent ? "text-white/80" : "text-slate-500 dark:text-slate-400";
  const navText = transparent
    ? "text-white hover:text-orange-200"
    : "text-slate-950 hover:text-orange-600 dark:text-white dark:hover:text-orange-300";
  const iconButtonClass = `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
    transparent
      ? "text-white hover:bg-white/15"
      : "text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10"
  }`;
  const primaryButtonClass = transparent
    ? "bg-white text-slate-950 hover:bg-orange-500 hover:text-white"
    : "bg-slate-950 text-white hover:bg-orange-600 dark:bg-white dark:text-slate-950 dark:hover:bg-orange-500 dark:hover:text-white";

  const avatarUrl =
    getProfilePhotoUrl(userProfile) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || "User")}`;

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-50 h-[68px] border-b transition-colors duration-300 ${headerSurface}`}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3"
            aria-label="JourneysPage home"
          >
            {siteLogo ? (
              <img
                src={siteLogo}
                alt="JourneysPage logo"
                className={`h-10 max-w-[132px] object-contain transition sm:h-11 sm:max-w-[168px] ${
                  transparent
                    ? "drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                    : dark
                      ? ""
                      : "brightness-0"
                }`}
              />
            ) : (
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                  transparent
                    ? "border-white/45 bg-white/10 text-white"
                    : "border-slate-200 bg-slate-950 text-white dark:border-white/10 dark:bg-white dark:text-slate-950"
                }`}
              >
                <Compass size={23} />
              </span>
            )}

            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-xl font-black tracking-normal sm:text-2xl">
                Journeys
              </span>
              <span className={`mt-0.5 text-[10px] font-black uppercase tracking-[0.38em] ${mutedText}`}>
                Page
              </span>
            </span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-6 lg:flex">
            {!user ? (
              <>
                {publicLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`text-[12px] font-black uppercase tracking-[0.18em] transition-colors ${navText}`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/login"
                  className={`text-[12px] font-black uppercase tracking-[0.18em] transition-colors ${navText}`}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className={`rounded-full px-7 py-3 text-sm font-black shadow-lg transition-colors ${primaryButtonClass}`}
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-2 text-sm font-black uppercase tracking-wide transition-colors ${navText}`}
                >
                  <LayoutDashboard size={18} /> Dashboard
                </Link>
                <Link
                  to="/create-story"
                  className={`flex items-center gap-2 text-sm font-black uppercase tracking-wide transition-colors ${navText}`}
                >
                  <PlusCircle size={18} /> Create
                </Link>
                {canReceiveReviewNotifications && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-2 text-sm font-black uppercase tracking-wide transition-colors ${navText}`}
                  >
                    <Shield size={18} /> Admin
                  </Link>
                )}

                <div className={transparent ? "text-white" : "text-slate-900 dark:text-white"}>
                  <NotificationBell isAdmin={canReceiveReviewNotifications} />
                </div>

                <button
                  type="button"
                  onClick={() => setDark((value) => !value)}
                  className={iconButtonClass}
                  aria-label="Toggle color theme"
                >
                  {dark ? <Sun size={21} /> : <Moon size={21} />}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((value) => !value)}
                    className={`flex h-11 items-center gap-2 rounded-full border pl-1 pr-3 transition-colors ${
                      transparent
                        ? "border-white/30 bg-white/10 text-white hover:bg-white/15"
                        : "border-slate-200 bg-slate-50 text-slate-900 hover:border-orange-500/50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    }`}
                    aria-label="Open account menu"
                    aria-expanded={menuOpen}
                  >
                    <img
                      src={avatarUrl}
                      className="h-9 w-9 rounded-full border-2 border-white/25 object-cover"
                      alt="Profile"
                    />
                    <ChevronDown
                      size={16}
                      className={`opacity-80 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  <AnimatePresence>
                    {menuOpen && (
                      <AccountMenu
                        userProfile={userProfile}
                        onClose={() => setMenuOpen(false)}
                        onLogout={() => setLogoutOpen(true)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
            {user && (
              <div className={transparent ? "text-white" : "text-slate-900 dark:text-white"}>
                <NotificationBell isAdmin={canReceiveReviewNotifications} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className={iconButtonClass}
              aria-label="Toggle color theme"
            >
              {dark ? <Sun size={21} /> : <Moon size={21} />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className={iconButtonClass}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={25} /> : <Menu size={25} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden border-b border-slate-200 bg-white/98 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0F19]/98 lg:hidden"
            >
              <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
                      <img
                        src={avatarUrl}
                        className="h-12 w-12 rounded-full border-2 border-slate-200 object-cover dark:border-white/10"
                        alt="User"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-950 dark:text-white">
                          {userProfile?.name || "Explorer"}
                        </div>
                        <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                          {userProfile?.email}
                        </div>
                      </div>
                    </div>
                    <MobileLink to="/dashboard" icon={<LayoutDashboard size={19} />}>
                      Dashboard
                    </MobileLink>
                    <MobileLink to="/create-story" icon={<PlusCircle size={19} />}>
                      Create Story
                    </MobileLink>
                    <MobileLink to="/profile" icon={<User size={19} />}>
                      Profile Settings
                    </MobileLink>
                    {canReceiveReviewNotifications && (
                      <MobileLink to="/admin" icon={<Shield size={19} />}>
                        Admin Panel
                      </MobileLink>
                    )}
                    <button
                      type="button"
                      onClick={() => setLogoutOpen(true)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-black text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <LogOut size={19} /> Log Out
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {publicLinks.map((link) => (
                      <MobileLink key={link.to} to={link.to}>
                        {link.label}
                      </MobileLink>
                    ))}
                    <MobileLink to="/login">Login</MobileLink>
                    <Link
                      to="/register"
                      className="mt-2 rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition-colors hover:bg-orange-600 dark:bg-white dark:text-slate-950 dark:hover:bg-orange-500 dark:hover:text-white"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)}>
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-500/10">
            <LogOut size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Sign out?</h3>
          <p className="mt-3 text-base font-medium text-slate-500 dark:text-slate-400">
            Are you sure you want to log out of your account?
          </p>
          <div className="mt-8 flex gap-4">
            <button
              type="button"
              onClick={() => setLogoutOpen(false)}
              className="flex-1 rounded-2xl bg-slate-100 px-6 py-3.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 rounded-2xl bg-red-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-red-700 hover:shadow-red-500/30"
            >
              Confirm Sign Out
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function AccountMenu({ userProfile, onClose, onLogout }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 10, scale: 0.96, filter: "blur(8px)" }}
      transition={{ duration: 0.18 }}
      className="absolute right-0 z-50 mt-4 w-72 origin-top-right overflow-hidden rounded-3xl border border-slate-100 bg-white/95 text-left shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-[#111625]/95"
    >
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 dark:border-white/5 dark:from-white/5 dark:to-transparent">
        <p className="truncate text-lg font-black leading-tight text-slate-900 dark:text-white">
          {userProfile?.name || "Explorer"}
        </p>
        <p className="mb-3 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {userProfile?.email}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2.5 py-1 text-xs font-extrabold text-white shadow-sm">
          <Shield size={12} /> Lvl {userProfile?.level || 1}
        </span>
      </div>
      <div className="space-y-1 p-3">
        <Link
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <User size={18} className="text-slate-400 dark:text-slate-500" />
          Profile Settings
        </Link>
        <Link
          to="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <LayoutDashboard size={18} className="text-slate-400 dark:text-slate-500" />
          Dashboard
        </Link>
      </div>
      <div className="border-t border-slate-100 p-3 dark:border-white/5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </motion.div>
  );
}

function MobileLink({ to, icon, children }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-black uppercase tracking-wide text-slate-800 transition-colors hover:bg-slate-100 hover:text-orange-600 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-orange-300"
    >
      {icon}
      {children}
    </Link>
  );
}
