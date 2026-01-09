import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom"; 
import { collection, query, where, limit, onSnapshot, doc, updateDoc } from "firebase/firestore"; 
import { db } from "../../services/firebase"; 
import { useAuth } from "../../contexts/AuthContext"; 
import { useNavigate } from "react-router-dom"; 
import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react"; 
import { Bell, Heart, X, Sparkles, Check, Quote, Star, User } from "lucide-react"; 
import confetti from "canvas-confetti";

// --- 1. DYNAMIC ICON RENDERER ---
const DynamicIcon = ({ name, className, size = 24 }) => {
    // If name is null/undefined, fallback to Sparkles immediately
    if (!name) return <Sparkles className={className} size={size} strokeWidth={1.5} />;
    
    // Check if icon exists in Lucide library
    const IconComp = LucideIcons[name] || Sparkles;
    return <IconComp className={className} size={size} strokeWidth={1.5} />;
};

// --- 2. ADAPTIVE RARITY THEMES ---
const getRarityTheme = (rarity) => {
    const r = rarity?.toUpperCase() || 'COMMON';
    switch (r) {
        case 'LEGENDARY': return { 
            bgGradient: 'bg-gradient-to-b from-amber-500/20 via-black to-amber-950', 
            border: 'border-amber-400', 
            textGradient: 'text-amber-400', // Simplified for reliability
            solidText: 'text-amber-400',
            glow: 'shadow-[0_0_80px_-10px_rgba(251,191,36,0.6)]',
            orbRing: 'border-amber-500 shadow-[0_0_30px_rgba(251,191,36,0.8)]',
            orbBg: 'bg-amber-500/10',
            badgeBg: 'bg-amber-500/10 border-amber-200/20 text-amber-400',
            
            // List Item Colors
            listIconBg: 'bg-amber-100 dark:bg-amber-500/10',
            listIconColor: 'text-amber-700 dark:text-amber-400',
            listTitleColor: 'text-amber-800 dark:text-amber-400',
        };
        case 'UNCOMMON': return { 
            bgGradient: 'bg-gradient-to-b from-cyan-500/20 via-black to-slate-950', 
            border: 'border-cyan-400', 
            textGradient: 'text-cyan-400',
            solidText: 'text-cyan-400',
            glow: 'shadow-[0_0_80px_-10px_rgba(34,211,238,0.5)]',
            orbRing: 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.8)]',
            orbBg: 'bg-cyan-500/10',
            badgeBg: 'bg-cyan-500/10 border-cyan-200/20 text-cyan-400',

            // List Item Colors
            listIconBg: 'bg-cyan-100 dark:bg-cyan-500/10',
            listIconColor: 'text-cyan-700 dark:text-cyan-400',
            listTitleColor: 'text-cyan-800 dark:text-cyan-400',
        };
        default: return { // COMMON
            bgGradient: 'bg-gradient-to-b from-purple-500/20 via-black to-slate-950', 
            border: 'border-purple-400', 
            textGradient: 'text-purple-400',
            solidText: 'text-purple-400',
            glow: 'shadow-[0_0_80px_-10px_rgba(192,132,252,0.5)]',
            orbRing: 'border-purple-400 shadow-[0_0_30px_rgba(192,132,252,0.8)]',
            orbBg: 'bg-purple-500/10',
            badgeBg: 'bg-purple-500/10 border-purple-200/20 text-purple-400',

            // List Item Colors
            listIconBg: 'bg-purple-100 dark:bg-purple-500/10',
            listIconColor: 'text-purple-700 dark:text-purple-400',
            listTitleColor: 'text-purple-800 dark:text-purple-400',
        };
    }
};

export default function InteractionHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeReplay, setActiveReplay] = useState(null); 
  const [playingLikeId, setPlayingLikeId] = useState(null); 
  const [isOpen, setIsOpen] = useState(false); 
  const dropdownRef = useRef(null);

  // --- FETCH REGISTRY ---
  const [giftRegistry, setGiftRegistry] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "gameRules"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const lootList = data.loot || [];
            const registryMap = {};
            lootList.forEach(item => {
                registryMap[item.name.trim().toLowerCase()] = {
                    name: item.name,
                    icon: item.icon,
                    rarity: item.rarity
                };
            });
            setGiftRegistry(registryMap);
        }
    });
    return () => unsub();
  }, []);

  // --- SMART PARSER ---
  const findRegistryItem = (note) => {
      if (!note) return null;
      // 1. Try Name
      if (note.itemName) {
          const key = note.itemName.trim().toLowerCase();
          if (giftRegistry[key]) return giftRegistry[key];
      }
      // 2. Try Message
      if (note.message) {
          const msgLower = note.message.toLowerCase();
          const foundKey = Object.keys(giftRegistry).find(key => msgLower.includes(key));
          if (foundKey) return giftRegistry[foundKey];
      }
      // 3. Fallback to embedded data (SAFE BACKUP)
      if (note.itemName) {
          return { name: note.itemName, icon: note.itemIcon || "Sparkles", rarity: note.itemRarity || "COMMON" };
      }
      return null;
  };

  // Live Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("recipientId", "==", user.uid), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- INTERACTION HANDLER ---
  const handleInteraction = async (note) => {
    if (!note.read) {
      try { await updateDoc(doc(db, "notifications", note.id), { read: true }); } catch (e) { console.error(e); }
    }

    if (note.type === 'gift') {
        setIsOpen(false);
        const item = findRegistryItem(note); 
        
        let colors = ['#a855f7', '#d8b4fe']; 
        if (item?.rarity === 'LEGENDARY') colors = ['#fbbf24', '#f59e0b', '#fffbeb']; 
        if (item?.rarity === 'UNCOMMON') colors = ['#22d3ee', '#06b6d4', '#ecfeff']; 

        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors, zIndex: 11000 });
        setActiveReplay(note);
    
    } else if (note.type === 'like') {
        setPlayingLikeId(note.id);
        setTimeout(() => setPlayingLikeId(null), 1000);
        confetti({
            particleCount: 40, spread: 60, origin: { y: 0.6 },
            colors: ['#ec4899', '#fce7f3', '#fbbf24'],
            ticks: 100, gravity: 0.8, scalar: 0.8,
            shapes: ['circle'], zIndex: 11000
        });
    } else if (note.link) {
        setIsOpen(false);
        navigate(note.link);
    }
  };

  const markAllRead = () => {
      notifications.forEach(n => {
          if(!n.read) updateDoc(doc(db, "notifications", n.id), { read: true });
      });
  };

  const handleProfileClick = (e, userId) => {
      e.stopPropagation(); 
      if (userId) {
          setActiveReplay(null); 
          navigate(`/profile/${userId}`);
      }
  };

  // --- CALCULATE ACTIVE THEME SAFELY ---
  const activeItemData = activeReplay ? findRegistryItem(activeReplay) : null;
  // Always default to COMMON to prevent "null reading..." crash
  const rarityTheme = getRarityTheme(activeItemData?.rarity || 'COMMON');

  return (
    <div className="relative" ref={dropdownRef}>
      
      {/* 🔔 BELL TRIGGER */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-xl border transition-all relative group z-[60]
            ${isOpen 
                ? 'bg-orange-500 text-white border-orange-600 shadow-lg' 
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-white'
            }`}
      >
        <div className="relative">
            <motion.div animate={unreadCount > 0 ? { rotate: [0, -20, 20, -20, 20, 0] } : {}} transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.5 }}>
                <Bell size={20} className={unreadCount > 0 ? 'fill-current' : ''} />
            </motion.div>
            {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-[#0B0F19] shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </div>
      </button>

      {/* 📜 NOTIFICATION LIST */}
      <AnimatePresence>
        {isOpen && (
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                className="fixed top-20 right-4 md:right-8 w-80 md:w-96 bg-white dark:bg-[#1A1F2E] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-white/10 overflow-hidden z-[9999] flex flex-col max-h-[70vh]"
            >
                <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/[0.02] shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><Bell size={14}/> Updates</h3>
                        {unreadCount > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{unreadCount} New</span>}
                    </div>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-[10px] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded transition-colors"><Check size={10}/> Read All</button>}
                </div>
                
                <div className="overflow-y-auto custom-scrollbar p-2 space-y-1 flex-1">
                    {notifications.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 opacity-50 flex flex-col items-center">
                            <Sparkles size={32} className="mb-2 text-slate-300 dark:text-slate-600"/>
                            <p className="text-xs font-medium">All caught up!</p>
                        </div>
                    ) : (
                        notifications.map((note) => {
                            const itemData = findRegistryItem(note);
                            const isGift = note.type === 'gift';
                            
                            // Adaptive Theme Logic for List Items
                            const currentTheme = getRarityTheme(itemData?.rarity || 'COMMON');
                            const storyName = note.storyTitle || null;

                            let iconName = "Bell"; 
                            let iconBgClass = "bg-slate-100 dark:bg-white/5"; 
                            let iconColorClass = "text-slate-500 dark:text-slate-400"; 
                            
                            if (note.type === 'like') {
                                iconName = "Heart";
                                iconBgClass = "bg-pink-100 dark:bg-pink-500/10";
                                iconColorClass = "text-pink-600 dark:text-pink-500";
                            } else if (isGift) {
                                iconName = itemData?.icon || "Sparkles";
                                iconBgClass = currentTheme.listIconBg; 
                                iconColorClass = currentTheme.listIconColor;
                            }

                            const displayTitle = isGift && itemData ? itemData.name : note.title;
                            const titleClass = isGift ? currentTheme.listTitleColor : (!note.read ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400');

                            return (
                                <div 
                                    key={note.id} 
                                    onClick={() => handleInteraction(note)} 
                                    className={`p-3 rounded-xl cursor-pointer transition-all flex gap-3 items-start group relative border border-transparent 
                                    ${!note.read ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                >
                                    <div className={`w-10 h-10 mt-0.5 rounded-xl flex items-center justify-center shrink-0 border border-black/5 dark:border-white/5 shadow-sm ${iconBgClass} ${iconColorClass}`}>
                                        <motion.div animate={playingLikeId === note.id ? { scale: [1, 1.4, 0.8, 1.2, 1], rotate: [0, 15, -15, 10, -10, 0] } : {}} transition={{ duration: 0.5 }}>
                                            <DynamicIcon name={iconName} size={18} />
                                        </motion.div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-xs font-bold truncate ${titleClass}`}>{displayTitle}</p>
                                                    {isGift && itemData && <span className={`text-[9px] px-1.5 py-[1px] rounded uppercase font-bold border tracking-wider ${currentTheme.badgeBg}`}>{itemData.rarity}</span>}
                                                </div>
                                            </div>
                                            <span className="text-[9px] text-slate-400 whitespace-nowrap ml-2 mt-0.5">{note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Now'}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{note.message}</p>
                                        {storyName && isGift && (
                                            <div className="mt-1 flex items-center gap-1 opacity-70">
                                                <span className="text-[9px] text-slate-500 dark:text-slate-500">on story</span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-300 font-medium truncate max-w-[150px]">"{storyName}"</span>
                                            </div>
                                        )}
                                    </div>
                                    {!note.read && <div className="w-2 h-2 mt-2 bg-orange-500 rounded-full shrink-0 animate-pulse" />}
                                </div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 🎁 PREMIUM GIFT POPUP 🎁 */}
      {activeReplay && (
        createPortal(
            <AnimatePresence>
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
                    onClick={(e) => { e.stopPropagation(); setActiveReplay(null); }}
                >
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0, y: 50 }} 
                        animate={{ scale: 1, opacity: 1, y: 0 }} 
                        exit={{ scale: 0.8, opacity: 0, y: 50 }} 
                        onClick={(e) => e.stopPropagation()} 
                        className={`relative w-full max-w-sm rounded-[3rem] p-[1px] shadow-2xl overflow-hidden group ${rarityTheme.glow}`}
                    >
                        {/* ANIMATED BORDER */}
                        <div className={`absolute inset-0 opacity-100 ${rarityTheme.bgGradient}`} />

                        <div className="relative bg-[#080a10] rounded-[3rem] h-full overflow-hidden flex flex-col items-center">
                            
                            {/* ROTATING RAYS (CSS ONLY, NO JIT) */}
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] pointer-events-none opacity-20">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    className="w-full h-full"
                                    style={{
                                        background: `conic-gradient(from 0deg, transparent 0deg, ${activeItemData?.rarity === 'LEGENDARY' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.1)'} 60deg, transparent 120deg)`
                                    }}
                                />
                            </div>

                            <button onClick={() => setActiveReplay(null)} className="absolute top-6 right-6 p-2 z-30 bg-black/30 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors border border-white/5 backdrop-blur-md">
                                <X size={20}/>
                            </button>

                            {/* RARITY BADGE */}
                            <div className="relative z-20 mt-10">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border flex items-center gap-2 backdrop-blur-md shadow-lg ${rarityTheme.badgeBg}`}>
                                    <Star size={10} className="fill-current"/>
                                    {activeItemData?.rarity || "SPECIAL"}
                                    <Star size={10} className="fill-current"/>
                                </span>
                            </div>
                            
                            {/* MAIN ICON STAGE */}
                            <div className="relative w-full h-72 flex items-center justify-center z-10">
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} 
                                    transition={{ duration: 4, repeat: Infinity }} 
                                    className={`absolute w-48 h-48 rounded-full blur-3xl ${rarityTheme.orbBg}`}
                                />
                                <motion.div 
                                    initial={{ scale: 0, rotate: -15, y: 20 }} 
                                    animate={{ scale: 1, rotate: 0, y: [0, -15, 0] }} 
                                    transition={{ scale: { type: "spring", stiffness: 200, damping: 15 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
                                    className={`relative z-10 ${rarityTheme.solidText}`}
                                >
                                    <DynamicIcon name={activeItemData?.icon || "Sparkles"} size={130} className={`drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] filter contrast-125`} />
                                    <motion.div animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -top-4 -right-4 text-white"><Sparkles size={24}/></motion.div>
                                    <motion.div animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }} className="absolute -bottom-2 -left-4 text-white"><Sparkles size={16}/></motion.div>
                                </motion.div>
                            </div>

                            {/* TEXT CONTENT CARD */}
                            <div className="w-full bg-white/5 backdrop-blur-2xl border-t border-white/10 p-8 pt-10 rounded-[2.5rem] -mt-12 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                                
                                {/* Avatar / Sender */}
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                    <div className="flex items-center gap-2 pl-1 pr-4 py-1 bg-[#0f131f] border border-white/20 rounded-full shadow-xl text-slate-300">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center border border-white/10">
                                            <User size={14} className="text-white"/>
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wide">
                                            {activeReplay.senderId ? (
                                                <span 
                                                    onClick={(e) => handleProfileClick(e, activeReplay.senderId)}
                                                    className="hover:text-white cursor-pointer transition-colors"
                                                >
                                                    {activeReplay.senderName || "Traveler"}
                                                </span>
                                            ) : (
                                                <span>{activeReplay.senderName || "Traveler"}</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-center mt-2 space-y-2">
                                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Gifted You</h2>
                                    <h1 className={`text-3xl font-black ${rarityTheme.textGradient || "text-white"}`}>
                                        {activeReplay.itemName || "Mystery Item"}
                                    </h1>
                                    
                                    {activeReplay.storyTitle && (
                                        <p className="text-xs text-slate-400 font-medium">
                                            on <span className="text-slate-200">"{activeReplay.storyTitle}"</span>
                                        </p>
                                    )}
                                </div>

                                {activeReplay.userNote && activeReplay.userNote.trim() !== "" && (
                                    <div className="mt-6 relative">
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1A1F2E] px-2 text-slate-500">
                                            <Quote size={16} fill="currentColor" />
                                        </div>
                                        <div className="border border-white/10 rounded-2xl p-4 text-center bg-black/20">
                                            <p className="text-sm italic text-slate-300 leading-relaxed font-medium">"{activeReplay.userNote}"</p>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="mt-6 text-center">
                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold animate-pulse">Item added to wallet</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>,
            document.body
        )
      )}
    </div>
  );
}