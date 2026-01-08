import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext"; // Adjust path
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageSquare, Gift, Footprints, X } from "lucide-react";

// --- ANIMATION VARIANTS ---
const variants = {
  initial: { x: 100, opacity: 0, scale: 0.8 },
  animate: { x: 0, opacity: 1, scale: 1 },
  exit: { x: 100, opacity: 0, scale: 0.8 }
};

const iconVariants = {
  like: { scale: [1, 1.4, 1], transition: { repeat: Infinity, duration: 1.5 } },
  gift: { rotate: [0, -10, 10, -10, 10, 0], transition: { repeat: Infinity, duration: 2 } },
  comment: { y: [0, -3, 0], transition: { repeat: Infinity, duration: 2 } },
  track: { x: [0, 5, 0], transition: { repeat: Infinity, duration: 1.5 } }
};

export default function NotificationStream() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;

    // Listen for UNREAD notifications intended for the current user
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", user.uid),
      where("read", "==", false),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Update state, but only keep unique IDs to prevent jitter
      setNotifications(newNotes);
    });

    return () => unsubscribe();
  }, [user]);

  // Function to mark as read (dismiss)
  const dismiss = async (id) => {
    try {
      const ref = doc(db, "notifications", id);
      await updateDoc(ref, { read: true });
    } catch (err) {
      console.error("Error dismissing notification", err);
    }
  };

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        dismiss(notifications[0].id);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  return (
    <div className="fixed top-24 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map((note) => (
          <NotificationCard key={note.id} note={note} onDismiss={() => dismiss(note.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// --- INDIVIDUAL CARD COMPONENT ---
const NotificationCard = ({ note, onDismiss }) => {
  let Icon = Heart;
  let color = "bg-red-500";
  let anim = iconVariants.like;
  let label = "New Like";

  // Customize based on type
  if (note.type === 'gift') {
    Icon = Gift;
    color = "bg-gradient-to-br from-yellow-400 to-orange-500";
    anim = iconVariants.gift;
    label = "Tribute Received!";
  } else if (note.type === 'comment') {
    Icon = MessageSquare;
    color = "bg-blue-500";
    anim = iconVariants.comment;
    label = "New Comment";
  } else if (note.type === 'track') {
    Icon = Footprints;
    color = "bg-emerald-500";
    anim = iconVariants.track;
    label = "New Tracker";
  }

  return (
    <motion.div
      layout
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="pointer-events-auto bg-[#1A1F2E]/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl w-80 flex items-center gap-4 relative overflow-hidden group"
    >
      {/* Glowing Background Effect */}
      <div className={`absolute left-0 top-0 w-1 h-full ${color}`} />
      
      {/* Animated Icon Container */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${color}`}>
        <motion.div animate={anim}>
          <Icon className="text-white" size={24} fill="currentColor" fillOpacity={0.2} />
        </motion.div>
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-[10px] font-bold uppercase tracking-widest opacity-80 ${note.type === 'gift' ? 'text-yellow-400' : 'text-slate-400'}`}>
          {label}
        </h4>
        <p className="text-white text-sm font-bold truncate">
          {note.message || "Someone interacted with your story."}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">Just now</p>
      </div>

      {/* Dismiss Button */}
      <button onClick={onDismiss} className="absolute top-2 right-2 p-1 text-slate-600 hover:text-white transition-colors">
        <X size={14} />
      </button>
    </motion.div>
  );
};