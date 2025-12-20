import { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import { addPoints } from "../services/profileService";
import { 
  CheckCircle, XCircle, Clock, Eye, 
  ShieldAlert, Calendar, User, FileText, X 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

export default function AdminPanel() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedStory, setSelectedStory] = useState(null); // For the Modal

  useEffect(() => {
    fetchStories();
  }, [filter]);

  async function fetchStories() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "stories"),
        where("status", "==", filter),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStories(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load stories");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(story, status) {
    const toastId = toast.loading(`Marking as ${status}...`);
    try {
      // 1. Update Story Status
      await updateDoc(doc(db, "stories", story.id), {
        status: status,
        moderatedAt: new Date()
      });

      // 2. If Approved, Reward Points
      if (status === "approved") {
        await addPoints(story.authorId || story.userId, 50, "Story Approved");
        toast.success("Approved & 50 Points Rewarded!", { id: toastId });
      } else {
        toast.success("Story Rejected", { id: toastId });
      }

      // 3. Refresh & Close Modal
      setSelectedStory(null);
      fetchStories();
    } catch (err) {
      console.error(err);
      toast.error("Action failed", { id: toastId });
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-6 md:p-10 font-sans">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="text-orange-500" /> Admin Console
            </h1>
            <p className="text-slate-400 mt-1">Moderation queue and content management.</p>
          </div>
          
          {/* Status Filters */}
          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 backdrop-blur-md">
            {[
                { id: "pending", label: "Pending", icon: Clock },
                { id: "approved", label: "Approved", icon: CheckCircle },
                { id: "rejected", label: "Rejected", icon: XCircle },
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${filter === tab.id 
                            ? "bg-orange-600 text-white shadow-lg shadow-orange-900/20" 
                            : "text-slate-400 hover:text-white hover:bg-white/5"}
                    `}
                >
                    <tab.icon size={16} /> {tab.label}
                </button>
            ))}
          </div>
        </div>

        {/* Stories Grid / Table */}
        <div className="bg-[#111625] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            {loading ? (
                <div className="p-12 text-center text-slate-500 animate-pulse">Loading content...</div>
            ) : stories.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                    <CheckCircle size={48} className="text-slate-700" />
                    <p>No stories found in this category.</p>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="p-5 font-semibold">Story Details</th>
                            <th className="p-5 font-semibold">Author</th>
                            <th className="p-5 font-semibold">Submitted</th>
                            <th className="p-5 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {stories.map((story) => (
                            <tr key={story.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-white/10">
                                            {story.coverImage ? (
                                                <img src={story.coverImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600"><FileText size={20} /></div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-base truncate max-w-[200px]">{story.title || "Untitled Story"}</div>
                                            <div className="text-slate-500 text-xs">{story.location || "Unknown Location"}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5">
                                    <div className="flex items-center gap-2 text-slate-300">
                                        <User size={14} className="text-orange-500" />
                                        {story.authorName || "Anonymous"}
                                    </div>
                                </td>
                                <td className="p-5 text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} />
                                        {story.createdAt?.seconds 
                                            ? new Date(story.createdAt.seconds * 1000).toLocaleDateString() 
                                            : "N/A"}
                                    </div>
                                </td>
                                <td className="p-5 text-right">
                                    <button 
                                        onClick={() => setSelectedStory(story)}
                                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ml-auto"
                                    >
                                        <Eye size={16} /> Review
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>

      {/* --- REVIEW MODAL --- */}
      <AnimatePresence>
        {selectedStory && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={() => setSelectedStory(null)}
            >
                <motion.div 
                    initial={{ scale: 0.95, y: 20 }} 
                    animate={{ scale: 1, y: 0 }} 
                    exit={{ scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()} // Prevent close on card click
                    className="bg-[#111625] border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
                >
                    {/* Modal Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{selectedStory.title}</h2>
                            <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                                <User size={14}/> {selectedStory.authorName} • <Clock size={14}/> {selectedStory.tripDuration || "N/A"} days
                            </p>
                        </div>
                        <button onClick={() => setSelectedStory(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                    </div>

                    {/* Modal Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {selectedStory.coverImage && (
                            <img src={selectedStory.coverImage} alt="Cover" className="w-full h-64 object-cover rounded-xl border border-white/10" />
                        )}
                        
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-orange-400 uppercase tracking-wide text-xs">Story Content</h3>
                            <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {selectedStory.aboutPlace || selectedStory.description || "No content provided."}
                            </div>
                        </div>

                        {/* Gallery Preview (If exists) */}
                        {selectedStory.gallery && selectedStory.gallery.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-orange-400 uppercase tracking-wide text-xs mb-3">Gallery</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {selectedStory.gallery.map((img, idx) => (
                                        <img key={idx} src={typeof img === 'string' ? img : img.url} className="h-20 w-full object-cover rounded-lg border border-white/10" alt="" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer (Actions) */}
                    {filter === 'pending' && (
                        <div className="p-6 border-t border-white/10 bg-white/5 flex gap-4 justify-end">
                            <button 
                                onClick={() => handleAction(selectedStory, "rejected")}
                                className="px-6 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 font-bold transition-all flex items-center gap-2"
                            >
                                <XCircle size={18} /> Reject
                            </button>
                            <button 
                                onClick={() => handleAction(selectedStory, "approved")}
                                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 font-bold transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={18} /> Approve & Reward
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}