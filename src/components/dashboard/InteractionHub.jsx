import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom"; 
import { collection, query, where, limit, onSnapshot, doc, updateDoc } from "firebase/firestore"; 
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Heart, Gift, MessageSquare, Footprints, X, Sparkles, Check, ChevronRight, Quote } from "lucide-react";
import * as LucideIcons from "lucide-react";
import confetti from "canvas-confetti";

// --- HELPER: Render Dynamic Icons ---
const DynamicIcon = ({ name, className, size = 16 }) => {
    const IconComponent = LucideIcons[name] || Gift;
    return <IconComponent className={className} size={size} />;
};

// --- HELPER: Rarity Styles ---
const getRarityStyles = (rarity) => {
    switch (rarity) {
        case 'LEGENDARY': return { bg: 'bg-gradient-to-br from-yellow-400 to-orange-600', text: 'text-yellow-100', border: 'border-yellow-500', shadow: 'shadow-yellow-500/50' };
        case 'EPIC': return { bg: 'bg-gradient-to-br from-purple-500 to-indigo-700', text: 'text-purple-100', border: 'border-purple-500', shadow: 'shadow-purple-500/50' };
        case 'RARE': return { bg: 'bg-gradient-to-br from-blue-400 to-cyan-600', text: 'text-blue-100', border: 'border-blue-500', shadow: 'shadow-blue-500/50' };
        default: return { bg: 'bg-gradient-to-br from-slate-600 to-slate-800', text: 'text-white', border: 'border-slate-500', shadow: 'shadow-slate-500/30' };
    }
};

const getNotificationStyles = (note) => {
  if (note.type === 'gift') {
      const rarity = note.itemRarity || 'COMMON';
      const theme = getRarityStyles(rarity);
      return { 
          iconName: note.itemIcon || 'Gift',
          color: 'text-slate-300', // List text color
          bg: `bg-slate-50 dark:bg-white/5 border-l-4 ${theme.border.replace('border', 'border-l')}`, // Left border indicates rarity in list
          label: rarity === 'COMMON' ? 'Tribute' : `${rarity} Tribute`
      };
  }
  switch (note.type) {
    case 'like': return { iconName: 'Heart', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', label: 'Like' };
    case 'comment': return { iconName: 'MessageSquare', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Comment' };
    case 'track': return { iconName: 'Footprints', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Tracker' };
    default: return { iconName: 'Bell', color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20', label: 'Update' };
  }
};

export default function InteractionHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeReplay, setActiveReplay] = useState(null); 
  const [isOpen, setIsOpen] = useState(false); 
  const bellRef = useRef(null);

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

  const handleInteraction = async (note) => {
    if (!note.read) {
      try { await updateDoc(doc(db, "notifications", note.id), { read: true }); } catch (e) { console.error(e); }
    }

    if (note.type === 'gift') {
      setIsOpen(false); 
      const colors = note.itemRarity === 'LEGENDARY' ? ['#FFD700', '#FFA500'] : ['#a855f7', '#3b82f6'];
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors });
      setActiveReplay(note);
    } else if (note.type === 'like') {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 }, colors: ['#EF4444', '#EC4899'] });
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

  return (
    <>
      {/* 1. BELL TRIGGER */}
      <button 
        ref={bellRef}
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

      {/* 2. DROPDOWN (Portal) */}
      {isOpen && createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                className="fixed top-20 right-4 md:right-8 w-[90vw] md:w-96 bg-white dark:bg-[#1A1F2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-[9999] flex flex-col max-h-[70vh]"
            >
                <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/[0.02] shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><Bell size={14}/> Updates</h3>
                        {unreadCount > 0 && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">{unreadCount} New</span>}
                    </div>
                    <div className="flex gap-2">
                        {unreadCount > 0 && <button onClick={markAllRead} className="text-[10px] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded transition-colors"><Check size={10}/> Clear</button>}
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full text-slate-400 transition-colors"><X size={16}/></button>
                    </div>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-2 space-y-1 flex-1">
                    {notifications.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 opacity-50 flex flex-col items-center">
                            <Sparkles size={32} className="mb-2 text-slate-300 dark:text-slate-600"/>
                            <p className="text-xs font-medium">All caught up!</p>
                        </div>
                    ) : (
                        notifications.map((note) => {
                            const style = getNotificationStyles(note);
                            return (
                                <div 
                                    key={note.id} 
                                    onClick={() => handleInteraction(note)} 
                                    className={`p-3 rounded-xl cursor-pointer transition-all flex gap-3 items-center group relative border border-transparent 
                                    ${!note.read ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'} ${style.bg}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${note.type === 'gift' ? 'bg-black/20 text-white' : 'bg-white dark:bg-white/5 text-slate-400'}`}>
                                        <DynamicIcon name={style.iconName} size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <p className={`text-xs font-bold truncate ${!note.read ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {note.type === 'gift' && note.itemName ? `Gift: ${note.itemName}` : note.title}
                                            </p>
                                            <span className="text-[9px] text-slate-400 whitespace-nowrap ml-2">{note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Now'}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-snug">{note.message}</p>
                                    </div>
                                    {!note.read ? <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0 animate-pulse" /> : <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"/>}
                                </div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* 3. FULL SCREEN REPLAY (Portal to BODY) */}
      {activeReplay && createPortal(
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
                onClick={(e) => { e.stopPropagation(); setActiveReplay(null); }}
            >
                <motion.div 
                    initial={{ scale: 0.5, y: 50 }} 
                    animate={{ scale: 1, y: 0 }} 
                    exit={{ scale: 0.5, y: 50 }} 
                    className="text-center w-full max-w-sm relative z-10"
                >
                    {/* ICON GLOBULE */}
                    <div className="mb-8 relative inline-block">
                        <div className={`absolute inset-0 rounded-full blur-3xl animate-pulse opacity-50 ${activeReplay.itemRarity === 'LEGENDARY' ? 'bg-yellow-500' : 'bg-orange-500'}`}/>
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center relative z-10 shadow-2xl border-4 ${getRarityStyles(activeReplay.itemRarity).border} ${getRarityStyles(activeReplay.itemRarity).bg}`}>
                            <DynamicIcon 
                                name={activeReplay.itemIcon || (activeReplay.type === 'like' ? 'Heart' : 'Gift')} 
                                size={64} 
                                className="text-white drop-shadow-md"
                            />
                        </div>
                    </div>

                    {/* TEXT CONTENT */}
                    <h2 className="text-4xl font-black text-white mb-2 tracking-tight drop-shadow-lg">
                        {activeReplay.type === 'gift' ? (activeReplay.itemName || "Reward!") : "New Like!"}
                    </h2>
                    
                    <p className="text-white/80 text-lg mb-6 font-medium leading-relaxed">
                        {activeReplay.message}
                    </p>

                    {/* 📝 PERSONAL NOTE DISPLAY */}
                    {activeReplay.userNote && (
                        <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-8 text-left backdrop-blur-sm relative">
                            <Quote size={20} className="text-white/30 absolute -top-3 -left-2 bg-[#1A1F2E] rounded-full p-0.5"/>
                            <p className="text-white italic text-sm leading-relaxed">"{activeReplay.userNote}"</p>
                        </div>
                    )}

                    <button 
                        onClick={() => setActiveReplay(null)} 
                        className="bg-white text-orange-600 px-10 py-3 rounded-xl font-bold shadow-2xl hover:scale-105 transition-transform active:scale-95 cursor-pointer ring-4 ring-orange-500/30"
                    >
                        Awesome!
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}