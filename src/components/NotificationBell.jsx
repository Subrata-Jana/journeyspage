import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, ExternalLink, AlertCircle, CheckCircle2, Info, Zap, MessageSquare, Heart } from "lucide-react";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "../services/firebase"; 
import { useAuth } from "../contexts/AuthContext"; 
import { markAllAsRead } from "../services/notificationService";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ⚡ FUTURE PROOF: Easy to add new types here without changing logic
const getNotificationStyle = (type) => {
    switch (type) {
        case 'alert': return { icon: <AlertCircle size={18} />, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10' };
        case 'success': return { icon: <CheckCircle2 size={18} />, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/10' };
        case 'warning': return { icon: <Zap size={18} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/10' };
        case 'social': return { icon: <Heart size={18} />, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/10' };
        case 'comment': return { icon: <MessageSquare size={18} />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10' };
        default: return { icon: <Info size={18} />, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' };
    }
};

export default function NotificationBell({ isAdmin }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ⚡ SMART QUERY: Listen to Personal + Admin + Broadcasts simultaneously
  useEffect(() => {
    if (!user?.uid) return;

    // 1. Always listen to Personal notifications
    const targetIds = [user.uid];

    // 2. If Admin, also listen to 'admin' channel
    if (isAdmin) targetIds.push('admin');

    // 3. Future Proof: Listen to 'broadcast' channel for system-wide announcements
    targetIds.push('broadcast');

    const q = query(
      collection(db, "notifications"),
      where("recipientId", "in", targetIds), // <--- THE KEY UPGRADE
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
        // Mark everything visible as read
        const targetIds = [user.uid, 'broadcast'];
        if(isAdmin) targetIds.push('admin');
        markAllAsRead(targetIds); 
    }
  };

  const handleItemClick = (link) => {
    setIsOpen(false);
    if (link) navigate(link);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleOpen} 
        className={`p-2.5 rounded-full transition-all relative ${isOpen ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-[#0B0F19] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 md:w-96 bg-white dark:bg-[#1A1F2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-50 origin-top-right"
          >
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Notifications</h3>
                <span className="text-xs text-slate-500 font-medium">{unreadCount} Unread</span>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center">
                        <Bell size={32} className="mb-2 opacity-20"/>
                        No new notifications
                    </div>
                ) : (
                    notifications.map((note) => {
                        const style = getNotificationStyle(note.type);
                        return (
                            <div 
                                key={note.id} 
                                onClick={() => handleItemClick(note.link)}
                                className={`p-4 border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/5 flex gap-3 ${!note.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                            >
                                <div className={`mt-1 shrink-0 ${style.color}`}>
                                    {style.icon}
                                </div>
                                <div className="flex-1">
                                    <h4 className={`text-sm font-bold mb-0.5 ${!note.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{note.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{note.message}</p>
                                    <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                                        {note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                    </span>
                                </div>
                                {!note.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>}
                            </div>
                        );
                    })
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}