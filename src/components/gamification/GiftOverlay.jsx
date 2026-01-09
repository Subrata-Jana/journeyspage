import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase"; // Adjust path if needed
import { useAuth } from "../../contexts/AuthContext"; // Adjust path if needed
import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { X, Sparkles, MapPin, User, Quote } from "lucide-react";

// Helper to render dynamic icons
const RenderIcon = ({ iconName, size = 48, className }) => {
  const Icon = LucideIcons[iconName] || LucideIcons.Gift;
  return <Icon size={size} className={className} />;
};

export default function GiftOverlay() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]); // Queue for multiple gifts
  const [activeGift, setActiveGift] = useState(null);
  
  // Track previous state to detect changes
  const prevTrophiesRef = useRef([]);
  const isFirstRun = useRef(true);

  // 1. LISTEN TO USER TROPHIES
  useEffect(() => {
    if (!user?.uid) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentTrophies = data.trophies || [];
        
        // Skip the very first load so we don't spam popups on login
        if (isFirstRun.current) {
            prevTrophiesRef.current = currentTrophies;
            isFirstRun.current = false;
            return;
        }

        // Compare Current vs Previous to find what's new
        const newItems = [];
        
        currentTrophies.forEach(curr => {
            const prev = prevTrophiesRef.current.find(p => p.name === curr.name);
            // If item didn't exist before, or count increased
            if (!prev || curr.count > prev.count) {
                const diff = curr.count - (prev ? prev.count : 0);
                // Push it to queue 'diff' times (in case they got 2 at once)
                for(let i=0; i<diff; i++) {
                    newItems.push(curr);
                }
            }
        });

        if (newItems.length > 0) {
            setQueue(prev => [...prev, ...newItems]);
        }

        // Update Ref
        prevTrophiesRef.current = currentTrophies;
      }
    });

    return () => unsub();
  }, [user]);

  // 2. PROCESS QUEUE
  useEffect(() => {
    if (!activeGift && queue.length > 0) {
        setActiveGift(queue[0]);
        setQueue(prev => prev.slice(1));
    }
  }, [queue, activeGift]);

  const handleClose = () => {
      setActiveGift(null);
  };

  return (
    <AnimatePresence>
      {activeGift && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-none">
            {/* BACKDROP BLUR */}
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                onClick={handleClose}
            />

            {/* GIFT CARD */}
            <motion.div 
                initial={{ scale: 0.5, opacity: 0, y: 100 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: -100 }}
                transition={{ type: "spring", damping: 15 }}
                className="relative bg-[#1A1F2E] border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center pointer-events-auto overflow-hidden"
            >
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-orange-500/20 to-transparent opacity-50 blur-3xl pointer-events-none" />

                {/* ANIMATED ICON */}
                <div className="relative z-10 mb-6 flex justify-center">
                    <motion.div 
                        animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className={`w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.4)]
                            ${activeGift.rarity === 'LEGENDARY' ? 'bg-gradient-to-tr from-yellow-600 to-yellow-400' : 
                              activeGift.rarity === 'Uncommon' ? 'bg-gradient-to-tr from-emerald-600 to-emerald-400' : 
                              'bg-gradient-to-tr from-slate-700 to-slate-500'}
                        `}
                    >
                        <RenderIcon iconName={activeGift.icon} size={48} className="text-white drop-shadow-md" />
                    </motion.div>
                    
                    {/* Floating Sparkles */}
                    <motion.div 
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5], rotate: [0, 180] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-2 -right-2 text-yellow-400"
                    >
                        <Sparkles size={24} />
                    </motion.div>
                </div>

            {/* TEXT CONTENT */}
            <div className="relative z-10 space-y-1">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
                    <User size={12} className="text-orange-400"/>
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        From {getSenderName(activeGift)}
                    </span>
                </motion.div>
                
                <motion.h2 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="text-3xl font-black text-white"
                >
                    {activeGift.itemName}
                </motion.h2>

                {/* STORY CONTEXT */}
                {activeGift.storyTitle && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center justify-center gap-1.5 text-slate-400 text-sm mt-1"
                    >
                        <span className="italic">for</span> 
                        <span className="text-orange-400 font-bold max-w-[200px] truncate">"{activeGift.storyTitle}"</span>
                    </motion.div>
                )}

                {/* ✨ NEW: PERSONAL MESSAGE ✨ */}
                {activeGift.userNote && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="mt-4 p-3 bg-white/5 border border-white/10 rounded-xl flex gap-2 items-start text-left mx-2"
                    >
                        <Quote size={14} className="text-slate-500 shrink-0 rotate-180 mt-0.5" />
                        <p className="text-sm italic text-slate-300 line-clamp-3">"{activeGift.userNote}"</p>
                    </motion.div>
                )}
        </div>
                {/* BUTTON */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    onClick={handleClose}
                    className="mt-8 w-full py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-200 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                    <Sparkles size={16} /> Collect
                </motion.button>

                <button onClick={handleClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}