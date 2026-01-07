import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { sendTribute } from "../../services/gamificationService";
import { RenderIcon } from "../../hooks/useGamification"; // Ensure you export this from hook or copy helper
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";

export default function GiftModal({ isOpen, onClose, authorId, storyId, authorName }) {
  const { user, userProfile } = useAuth();
  const [selectedItem, setSelectedItem] = useState(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Filter valid items (remove legacy strings and expired items)
  const validItems = (userProfile?.inventory || []).filter(item => {
    if (typeof item === 'string') return false; // Ignore legacy
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) return false; // Ignore expired
    return true;
  });

  const handleSend = async () => {
    if (!selectedItem || !user) return;
    setSending(true);

    const result = await sendTribute(user.uid, authorId, storyId, selectedItem, message);

    if (result.success) {
      confetti({ particleCount: 150, spread: 60, origin: { y: 0.7 }, colors: ['#F59E0B', '#EF4444'] });
      toast.success(`You sent a ${selectedItem.name} to ${authorName}!`);
      onClose();
    } else {
      toast.error("Failed to send tribute.");
    }
    setSending(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#111625] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative"
      >
        {/* HEADER */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span className="text-xl">🎁</span> Send a Tribute
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6">
          <p className="text-sm text-slate-400 mb-4">
            Select an item from your wallet to gift to <span className="text-white font-bold">{authorName}</span>. 
            This will permanently add it to their showcase.
          </p>

          {/* GRID */}
          <div className="grid grid-cols-3 gap-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar">
            {validItems.map((item, idx) => {
               const expires = item.expiresAt ? new Date(item.expiresAt) : null;
               const timeString = expires ? formatDistanceToNow(expires) : "";
               
               return (
                <button 
                  key={idx}
                  onClick={() => setSelectedItem(item)}
                  className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all relative overflow-hidden group
                    ${selectedItem === item 
                      ? 'bg-orange-500/20 border-orange-500 ring-1 ring-orange-500' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                  <div className={`p-2 rounded-full mb-2 text-white ${selectedItem === item ? 'bg-orange-500' : 'bg-white/10'}`}>
                    <RenderIcon iconName={item.icon} size={20}/>
                  </div>
                  <div className="text-[10px] font-bold text-white truncate w-full">{item.name}</div>
                  
                  {expires && (
                    <div className="text-[9px] text-slate-500 mt-1 flex items-center gap-1">
                       <Clock size={8}/> {timeString}
                    </div>
                  )}
                </button>
               )
            })}
            {validItems.length === 0 && (
                <div className="col-span-3 text-center py-8 border border-dashed border-white/10 rounded-xl">
                    <AlertCircle className="mx-auto text-slate-500 mb-2"/>
                    <p className="text-xs text-slate-500">Your wallet is empty.</p>
                </div>
            )}
          </div>

          {/* MESSAGE INPUT */}
          {selectedItem && (
            <div className="mb-6 animate-in slide-in-from-bottom-2 fade-in">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Attach a Note (Optional)</label>
                <textarea 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
                    placeholder={`Tell ${authorName} why you loved this story...`}
                    rows={2}
                    maxLength={140}
                />
            </div>
          )}

          {/* FOOTER ACTION */}
          <button 
            disabled={!selectedItem || sending}
            onClick={handleSend}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                ${!selectedItem 
                    ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-600 to-orange-500 hover:scale-[1.02] text-white shadow-lg shadow-orange-900/20'}`}
          >
            {sending ? "Sending..." : <><Send size={18}/> Send Tribute</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}