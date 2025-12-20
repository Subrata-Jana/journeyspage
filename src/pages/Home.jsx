import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../services/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Compass, MapPin, ArrowRight, Star, 
  Mountain, Palmtree, Tent, Camera, Coffee, ChevronDown, Flame, Users, Globe
} from "lucide-react";

// Import Premium Footer
import Footer from "../components/Footer"; 

/* --- 1. SKELETON LOADER (Premium Loading State) --- */
const SkeletonCard = () => (
  <div className="bg-white dark:bg-[#111625] rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/5 shadow-sm">
    <div className="h-64 bg-slate-200 dark:bg-white/5 animate-pulse" /> {/* Image */}
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <div className="h-3 w-4 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
        <div className="h-3 w-20 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
      </div>
      <div className="h-6 w-3/4 bg-slate-200 dark:bg-white/5 rounded animate-pulse" /> {/* Title */}
      <div className="h-3 w-full bg-slate-200 dark:bg-white/5 rounded animate-pulse" /> {/* Desc */}
      <div className="h-3 w-2/3 bg-slate-200 dark:bg-white/5 rounded animate-pulse" /> {/* Desc */}
      <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between">
         <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-white/5 animate-pulse" />
         <div className="h-4 w-10 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

/* --- 2. HERO SLIDER --- */
const HeroSlider = ({ stories, loading }) => {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (stories.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % stories.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [stories.length]);

  // Use Skeleton for Hero Loading? Or keep spinner just for Hero? 
  // Hero is big, spinner is okay, but let's make it subtle.
  if (loading) return <div className="h-screen w-full bg-[#0B0F19]" />;

  const activeStory = stories.length > 0 ? stories[index] : {
    id: "demo",
    title: "Start Your Adventure",
    location: "Unknown Lands",
    coverImage: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop",
    authorName: "JourneysPage"
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStory.id || "default"}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
        >
          <img src={activeStory.coverImage} alt={activeStory.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 z-10" /> 
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-transparent z-10 opacity-90" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4 pt-20">
        <motion.div
          key={`text-${activeStory.id}`}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-4xl space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/50 backdrop-blur-md text-orange-400 font-bold uppercase text-xs tracking-widest">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span> Featured Journey
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight drop-shadow-2xl">
            {activeStory.title}
          </h1>
          <div className="flex items-center justify-center gap-6 text-white/90 text-lg font-medium">
            <span className="flex items-center gap-2"><MapPin size={20} className="text-orange-500"/> {activeStory.location}</span>
            <span className="hidden md:inline text-white/30">|</span>
            <span className="flex items-center gap-2">By {activeStory.authorName}</span>
          </div>
          <button 
            onClick={() => navigate(`/story/${activeStory.id}`)}
            className="mt-8 px-8 py-4 bg-white text-slate-900 hover:bg-orange-500 hover:text-white rounded-full font-bold text-lg transition-all duration-300 flex items-center gap-3 mx-auto shadow-xl hover:scale-105"
          >
            Read Full Story <ArrowRight size={20} />
          </button>
        </motion.div>
      </div>

      <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-white/50 flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
        <ChevronDown size={24} />
      </motion.div>
    </div>
  );
};

/* --- CATEGORY SECTION --- */
const categories = [
  { label: "Trekking", icon: <Mountain size={18}/> },
  { label: "Beaches", icon: <Palmtree size={18}/> },
  { label: "Camping", icon: <Tent size={18}/> },
  { label: "Photography", icon: <Camera size={18}/> },
  { label: "Relaxing", icon: <Coffee size={18}/> },
];

const CategorySection = ({ active, setActive }) => (
  <section className="sticky top-[72px] z-40 py-4 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 transition-colors duration-300">
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <button 
          onClick={() => setActive("All")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all whitespace-nowrap text-sm font-bold ${active === "All" ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-lg' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
        >
          <Compass size={18}/> All
        </button>
        {categories.map(cat => (
          <button 
            key={cat.label} 
            onClick={() => setActive(cat.label)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all whitespace-nowrap text-sm font-bold ${active === cat.label ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
    </div>
  </section>
);

/* --- 3. STATS PARALLAX BANNER (New Feature) --- */
const StatsBanner = () => (
    <div className="relative py-20 bg-slate-900 overflow-hidden my-10">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-purple-600/20"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
                <div className="text-4xl font-black text-white">500+</div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Journeys Shared</div>
            </div>
            <div className="space-y-2">
                <div className="text-4xl font-black text-white">50+</div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Countries</div>
            </div>
            <div className="space-y-2">
                <div className="text-4xl font-black text-white">10k</div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Photos</div>
            </div>
            <div className="space-y-2">
                <div className="text-4xl font-black text-white">100%</div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Free to Join</div>
            </div>
        </div>
    </div>
);

/* --- MAIN COMPONENT --- */
export default function Home() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const q = query(
          collection(db, "stories"),
          where("published", "==", true),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        setStories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  const filteredStories = stories.filter(story => 
    activeCategory === "All" || story.tripType === activeCategory
  );

  return (
    <div className="-mt-[88px]"> {/* Pull Hero behind Header */}
      
      <HeroSlider stories={stories} loading={loading} />
      <CategorySection active={activeCategory} setActive={setActiveCategory} />

      {/* STATS BANNER: Breaks visual monotony */}
      <StatsBanner />

      <section className="max-w-7xl mx-auto px-6 pb-20 pt-10 min-h-[50vh]">
        <div className="flex items-center gap-4 mb-10">
           <div className="p-3 bg-orange-100 dark:bg-orange-500/20 rounded-2xl text-orange-600 dark:text-orange-400">
             <Flame size={28} fill="currentColor" />
           </div>
           <div>
             <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Recent Adventures
             </h2>
             <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                Curated journeys from our community.
             </p>
           </div>
        </div>

        {/* LOADING STATE: Show Skeletons instead of Spinner */}
        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
        ) : filteredStories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStories.map((story, i) => (
              <motion.div 
                key={story.id} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                onClick={() => navigate(`/story/${story.id}`)} 
                className="group cursor-pointer bg-white dark:bg-[#111625] rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1"
              >
                  <div className="h-64 overflow-hidden relative">
                      <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white border border-transparent dark:border-white/10">
                        {story.tripType || "Adventure"}
                      </div>
                  </div>
                  <div className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                         <MapPin size={14} className="text-orange-500"/>
                         <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{story.location}</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-orange-500 transition-colors">
                        {story.title}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 leading-relaxed">
                        {story.aboutPlace}
                      </p>
                      
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                <img src={`https://ui-avatars.com/api/?name=${story.authorName}`} alt="User" />
                            </div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{story.authorName}</span>
                         </div>
                         <div className="flex items-center gap-1 text-orange-500 text-xs font-bold">
                            <Star size={12} fill="currentColor"/> {story.likes || 0}
                         </div>
                      </div>
                  </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white dark:bg-[#111625] rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/10 transition-colors duration-300">
             <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600">
                <Compass size={40}/>
             </div>
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No stories found</h3>
             <p className="text-slate-500 dark:text-slate-400">Be the first to write about {activeCategory}!</p>
             <button onClick={() => navigate('/create-story')} className="mt-6 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold text-sm transition-all shadow-lg hover:shadow-orange-500/25">
                Create Story
             </button>
          </div>
        )}
      </section>

      {/* Premium Footer */}
      
    </div>
  );
}