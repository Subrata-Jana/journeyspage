import React, { useEffect, useState } from 'react';
import { X, Gift, Send, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase'; 
import { useAuth } from '../../contexts/AuthContext'; 
import { sendTribute } from '../../services/gamificationService'; 
import toast from 'react-hot-toast';
import * as LucideIcons from "lucide-react";

// Helper to render icons safely
const RenderIcon = ({ iconName, size = 24, className }) => {
    const Icon = LucideIcons[iconName] || LucideIcons.HelpCircle;
    return <Icon size={size} className={className} />;
};

export default function GiftModal({ isOpen, onClose, authorId, authorName, storyId, storyTitle }) {
    const { user } = useAuth();
    const [step, setStep] = useState(1); 
    const [walletItems, setWalletItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    // 1. Fetch REAL-TIME Inventory
    useEffect(() => {
        if (!user?.uid || !isOpen) return;

        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const now = new Date();
                
                // Filter out expired items
                const validItems = (data.inventory || []).filter(item => {
                    const expiresAt = new Date(item.expiresAt);
                    return expiresAt > now;
                });
                
                setWalletItems(validItems);
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user, isOpen]);

    // Helper to show time left
    const getTimeLeft = (isoString) => {
        const diff = new Date(isoString) - new Date();
        const hours = Math.ceil(diff / (1000 * 60 * 60));
        if (hours > 24) return `${Math.ceil(hours / 24)}d left`;
        return `${hours}h left`;
    };

    // --- HANDLE SEND (UPDATED) ---
    const handleSend = async () => {
        if (!selectedItem) return;
        setSending(true);
        
        // ⚡ Pass storyTitle to the service so it creates the notification automatically
        const result = await sendTribute(user.uid, authorId, storyId, selectedItem, message, storyTitle);
        
        if (result.success) {
            // Notification is now handled inside the 'sendTribute' transaction.
            // We just show success toast and close.
            
            toast.success(`Sent ${selectedItem.name} to ${authorName}!`);
            onClose();
            setStep(1);
            setSelectedItem(null);
            setMessage("");
        } else {
            toast.error(result.error || "Failed to send gift");
        }
        setSending(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1A1F2E] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* HEADER */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <Gift className="text-orange-500" size={20}/> Send a Tribute
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Rewarding <b>{authorName}</b> for this story.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {step === 1 ? (
                        <>
                            <p className="text-sm text-slate-400 mb-4 font-medium">Select an artifact from your wallet:</p>
                            
                            {loading ? (
                                <div className="py-10 text-center text-slate-500">Loading wallet...</div>
                            ) : walletItems.length === 0 ? (
                                <div className="py-10 text-center border-2 border-dashed border-white/10 rounded-2xl">
                                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle className="text-slate-500" />
                                    </div>
                                    <p className="text-slate-400 font-bold">Your wallet is empty</p>
                                    <p className="text-xs text-slate-600 mt-1">Come back tomorrow for a daily reward!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {walletItems.map((item, idx) => (
                                        <button 
                                            key={`${item.itemId}-${idx}`}
                                            onClick={() => setSelectedItem(item)}
                                            className={`relative p-4 rounded-xl border-2 text-left transition-all group
                                                ${selectedItem === item 
                                                    ? 'bg-orange-600/20 border-orange-500' 
                                                    : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5'}
                                            `}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white
                                                    ${item.rarity === 'LEGENDARY' ? 'bg-yellow-500 shadow-lg shadow-yellow-500/20' : 
                                                      item.rarity === 'Uncommon' ? 'bg-emerald-600' : 
                                                      'bg-slate-600'}
                                                `}>
                                                    <RenderIcon iconName={item.icon} size={20} />
                                                </div>
                                                {selectedItem === item && <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white"><X size={12}/></div>}
                                            </div>
                                            <div className="font-bold text-white text-sm truncate">{item.name}</div>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Clock size={10} className="text-orange-400"/>
                                                <span className="text-[10px] font-mono text-orange-400">{getTimeLeft(item.expiresAt)}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                <div className="w-12 h-12 rounded-lg bg-black/40 flex items-center justify-center text-orange-500 shrink-0">
                                    <RenderIcon iconName={selectedItem.icon} size={24} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-orange-500 uppercase tracking-wider">Sending</div>
                                    <div className="text-lg font-black text-white">{selectedItem.name}</div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Attach a Note (Optional)</label>
                                <textarea 
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-orange-500 resize-none placeholder:text-slate-600"
                                    rows={3}
                                    placeholder="Write something nice..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-white/10 bg-white/5">
                    {step === 1 ? (
                        <button 
                            disabled={!selectedItem} 
                            onClick={() => setStep(2)}
                            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            Next Step
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setStep(1)}
                                className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white transition-colors"
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleSend}
                                disabled={sending}
                                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                            >
                                {sending ? "Sending..." : <><Send size={18}/> Send Tribute</>}
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}