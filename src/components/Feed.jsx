import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { db } from "../services/firebase"; 
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MapPin, Star, Clock, Compass, Search } from "lucide-react";

// --- SKELETON LOADER ---
const FeedSkeleton = () => (
  <div className="bg-white dark:bg-[#111625] rounded-3xl overflow-hidden border border-slate-200 dark:border-white/5 shadow-sm">
    <div className="h-56 bg-slate-200 dark:bg-white/5 animate-pulse" />
    <div className="p-5 space-y-3">
      <div className="h-6 w-3/4 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
      <div className="h-4 w-full bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
      <div className="flex justify-between pt-2">
         <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-white/5 animate-pulse" />
         <div className="h-4 w-12 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

const Feed = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStories = async () => {
      try {
        // Query: Only show PUBLISHED stories, newest first
        const storiesRef = collection(db, "stories");
        const q = query(
            storiesRef, 
            where("published", "==", true),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        const storiesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setStories(storiesData);
      } catch (error) {
        console.error("Error fetching stories:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, []);

  // Search Filter
  const filteredStories = stories.filter(story => 
    story.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    story.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Community Feed</h2>
            <p className="text-slate-500 dark:text-slate-400">Discover where others are traveling.</p>
        </div>
        
        <div className="relative group w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={18} />
            <input 
                type="text" 
                placeholder="Search locations..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all shadow-sm"
            />
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1,2,3,4,5,6].map(i => <FeedSkeleton key={i} />)}
        </div>
      ) : filteredStories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map((story, i) => (
            <motion.div 
              key={story.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/story/${story.id}`)}
              className="group cursor-pointer bg-white dark:bg-[#111625] rounded-3xl overflow-hidden border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Image Cover */}
              <div className="h-56 overflow-hidden relative">
                <img 
                  src={story.coverImage || story.imageUrl || "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1"} 
                  alt={story.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    {story.tripType || "Adventure"}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                    <MapPin size={14} className="text-orange-500"/>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{story.location || "Unknown"}</span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 group-hover:text-orange-500 transition-colors">
                    {story.title}
                </h3>
                
                <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 leading-relaxed mb-4">
                     {/* Strip HTML tags if using Rich Text, or just show raw if plain text */}
                    {story.aboutPlace?.replace(/<[^>]*>?/gm, '') || story.description || "No description available."}
                </p>

                <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                            <img src={`https://ui-avatars.com/api/?name=${story.authorName}`} alt="Author" />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{story.authorName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Clock size={12}/> {new Date(story.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
            <Compass className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No stories found</h3>
            <p className="text-slate-500 dark:text-slate-400">Try searching for a different location.</p>
        </div>
      )}
    </div>
  );
};

export default Feed;