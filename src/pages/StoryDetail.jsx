import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { motion } from "framer-motion"; // Import Animation Library
import { 
  MapPin, Calendar, Flag, Mountain, Info, Lightbulb, User, 
  Utensils, BedDouble, Navigation, ArrowRight, X, ChevronLeft, ChevronRight, QrCode
} from "lucide-react";
import { db } from "../services/firebase";

export default function StoryDetail() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();
  
  const [story, setStory] = useState(null);
  const [authorProfile, setAuthorProfile] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🖼️ GALLERY & LIGHTBOX STATE
  const [fullGallery, setFullGallery] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!storyId) return;

    async function fetchStoryAndAuthor() {
      try {
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);

        if (!storySnap.exists()) {
          navigate("/dashboard");
          return;
        }

        const storyData = storySnap.data();
        const currentUserId = auth.currentUser?.uid;
        if (!storyData.published && storyData.authorId !== currentUserId) {
          navigate("/dashboard");
          return;
        }

        if (storyData.authorId) {
            try {
                const userDoc = await getDoc(doc(db, "users", storyData.authorId));
                if (userDoc.exists()) setAuthorProfile(userDoc.data());
            } catch (err) { console.error(err); }
        }

        const daysRef = collection(db, "stories", storyId, "days");
        const q = query(daysRef, orderBy("dayNumber", "asc"));
        const daysSnap = await getDocs(q);
        const daysData = daysSnap.docs.map(d => d.data());

        setStory({ id: storySnap.id, ...storyData });
        setDays(daysData);

        // Aggregate Images
        const allImages = [];
        if (storyData.coverImage) {
            allImages.push({ url: storyData.coverImage, caption: storyData.coverImageCaption || "Cover Photo" });
        }
        daysData.forEach(d => { 
            if (d.imageUrl) {
                allImages.push({ url: d.imageUrl, caption: d.imageCaption || `Day ${d.dayNumber}: ${d.title}` });
            }
        });
        if (storyData.gallery && Array.isArray(storyData.gallery)) {
            storyData.gallery.forEach(item => {
                if (typeof item === 'string') {
                    allImages.push({ url: item, caption: "" });
                } else {
                    allImages.push({ url: item.url, caption: item.caption || "" });
                }
            });
        }
        setFullGallery(allImages);

      } catch (err) {
        console.error("Error:", err);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchStoryAndAuthor();
  }, [storyId, navigate, auth]);

  // --- LIGHTBOX LOGIC ---
  const openLightbox = (url) => {
    const idx = fullGallery.findIndex(img => img.url === url);
    if (idx !== -1) setLightboxIndex(idx);
  };
  const closeLightbox = () => setLightboxIndex(-1);
  const nextImage = useCallback((e) => {
    e?.stopPropagation();
    setLightboxIndex((prev) => (prev + 1) % fullGallery.length);
  }, [fullGallery.length]);
  const prevImage = useCallback((e) => {
    e?.stopPropagation();
    setLightboxIndex((prev) => (prev - 1 + fullGallery.length) % fullGallery.length);
  }, [fullGallery.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === -1) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, nextImage, prevImage]);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading Journey...</div>;
  if (!story) return null;

  return (
    <div className="bg-white min-h-screen pb-20">
      
      {/* --- HERO HEADER --- */}
      <div className="relative h-[70vh] w-full bg-slate-900">
        {story.coverImage ? (
          <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover opacity-90" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">No Cover</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        {/* Author Badge */}
        <div className="absolute top-24 right-6 md:right-12 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-2xl animate-in fade-in slide-in-from-top-4 z-20 cursor-default">
            <div className="relative">
                {authorProfile?.photoURL ? (
                    <img src={authorProfile.photoURL} alt="Author" className="w-12 h-12 rounded-full border-2 border-orange-500 object-cover" />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-white border-2 border-orange-500">
                        <User size={20} />
                    </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-orange-600 text-[10px] text-white px-1.5 py-0.5 rounded-full font-bold border border-black">
                    Lvl {authorProfile?.level || 1}
                </div>
            </div>
            <div className="text-white">
                <div className="text-xs text-orange-300 font-bold uppercase tracking-wider">{authorProfile?.badge || "Scout"}</div>
                <div className="font-bold text-lg leading-tight">{story.authorName}</div>
            </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 max-w-7xl mx-auto pointer-events-none">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge icon={<MapPin size={12}/>} text={story.location} color="bg-blue-500/20 text-blue-200 border-blue-500/30" />
            <Badge icon={<Calendar size={12}/>} text={story.month} color="bg-orange-500/20 text-orange-200 border-orange-500/30" />
            <Badge icon={<Flag size={12}/>} text={story.tripType} color="bg-green-500/20 text-green-200 border-green-500/30" />
            <Badge icon={<Mountain size={12}/>} text={story.difficulty} color="bg-red-500/20 text-red-200 border-red-500/30" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 leading-tight drop-shadow-lg">{story.title}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-8 relative z-10">
        
        {/* --- STATS BAR --- */}
        <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-wrap gap-8 items-center justify-between border border-slate-100">
          <div>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Duration</div>
            <div className="text-xl font-bold text-slate-800">{days.length} Days</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Est. Cost</div>
            <div className="text-xl font-bold text-slate-800">₹{story.totalCost || "N/A"}</div>
          </div>
          <div className="flex-1 flex justify-end gap-3">
             
             {/* ✅ FIXED QR CODE SECTION */}
             <div className="relative">
                <button 
                    onClick={() => setShowQr(!showQr)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showQr ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                    <QrCode size={20} />
                </button>
                {showQr && (
                    <div className="absolute top-12 right-0 w-48 bg-white p-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-100 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 mb-2">
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.href}`} 
                                alt="QR Code" 
                                className="w-full h-auto"
                            />
                        </div>
                        <div className="text-[10px] text-center text-slate-500 font-medium uppercase tracking-wide">
                            Scan to view on mobile
                        </div>
                    </div>
                )}
             </div>

            <button className="bg-orange-600 text-white px-6 py-2 rounded-full font-medium shadow-lg hover:bg-orange-700 transition-colors">
              Share Journey
            </button>
          </div>
        </div>

        {/* --- TIMELINE DAYS (WITH SCROLL ANIMATION) --- */}
        <div className="mt-16 space-y-12 relative">
          {/* Vertical Line */}
          <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-slate-200 hidden md:block" />

          {days.map((day, i) => (
            <motion.div 
              key={i} 
              className="relative md:pl-16"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.1 }} // Stagger effect
            >
              {/* Timeline Dot */}
              <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold shadow-lg z-10 hidden md:flex border-4 border-white">
                {day.dayNumber}
              </div>

              {/* Day Card */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
                 {/* Mobile Day Header */}
                 <div className="md:hidden bg-orange-50 px-4 py-2 border-b border-orange-100 flex items-center gap-2">
                    <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{day.dayNumber}</span>
                    <span className="font-semibold text-orange-800">Day {day.dayNumber}</span>
                 </div>

                 {day.imageUrl && (
                   <div className="h-64 md:h-80 overflow-hidden relative">
                     <img src={day.imageUrl} alt="Day" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                     {day.imageCaption && (
                        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                            <p className="text-white/90 text-sm font-medium">{day.imageCaption}</p>
                        </div>
                     )}
                   </div>
                 )}
                 
                 <div className="p-6 md:p-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">{day.title}</h2>
                    <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-line mb-6">{day.story}</p>
                    
                    {/* ✅ PREMIUM DETAILS GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(day.departure || day.destination) && (
                            <DetailCard icon={<Navigation size={18} className="text-blue-600"/>} label="Route" bg="bg-blue-50" border="border-blue-100">
                                <div className="flex items-center gap-2 truncate">
                                    {day.departure} <ArrowRight size={14} className="text-blue-300"/> {day.destination}
                                </div>
                            </DetailCard>
                        )}
                        {day.stay && <DetailCard icon={<BedDouble size={18} className="text-purple-600"/>} label="Accommodation" value={day.stay} bg="bg-purple-50" border="border-purple-100"/>}
                        {day.food && <DetailCard icon={<Utensils size={18} className="text-orange-600"/>} label="Food & Drink" value={day.food} bg="bg-orange-50" border="border-orange-100"/>}
                        {day.travel && <DetailCard icon={<MapPin size={18} className="text-emerald-600"/>} label="Commute" value={day.travel} bg="bg-emerald-50" border="border-emerald-100"/>}
                    </div>

                    {day.highlight && (
                      <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-yellow-800 italic text-center relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-600 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white shadow-sm">Highlight</div>
                        " {day.highlight} "
                      </div>
                    )}
                 </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* --- DETAILS & VIDEO --- */}
        <div className="mt-24 space-y-12">
            {(story.aboutPlace || story.specialNote) && (
                <div className="grid md:grid-cols-2 gap-6">
                    {story.aboutPlace && (
                        <div className="bg-yellow-50/50 border border-yellow-100 rounded-2xl p-6 relative">
                            <div className="absolute top-6 right-6 text-yellow-500 opacity-20"><Info size={48} /></div>
                            <h3 className="text-xl font-bold text-yellow-800 mb-3">About the Place</h3>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-line">{story.aboutPlace}</p>
                        </div>
                    )}
                    {story.specialNote && (
                        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6 relative">
                            <div className="absolute top-6 right-6 text-red-500 opacity-20"><Lightbulb size={48} /></div>
                            <h3 className="text-xl font-bold text-red-800 mb-3">Traveler Tips</h3>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-line">{story.specialNote}</p>
                        </div>
                    )}
                </div>
            )}

            {story.youtubeLink && getYoutubeId(story.youtubeLink) && (
                <div className="rounded-2xl overflow-hidden shadow-2xl bg-black">
                    <iframe 
                        className="w-full aspect-video"
                        src={`https://www.youtube.com/embed/${getYoutubeId(story.youtubeLink)}`} 
                        title="Trip Video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                </div>
            )}

            {/* --- GALLERY SECTION --- */}
            {fullGallery.length > 0 && (
                <div id="gallery">
                    <h2 className="text-3xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                    <span className="w-2 h-8 bg-purple-500 rounded-full" /> Photo Gallery
                    </h2>
                    <div className="columns-2 md:columns-3 gap-4 space-y-4">
                    {fullGallery.map((img, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => openLightbox(img.url)}
                            className="break-inside-avoid rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-zoom-in group relative"
                        >
                            <img src={img.url} alt="Gallery" className="w-full h-auto transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            {/* Caption Preview */}
                            {img.caption && (
                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-4 pt-12 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white text-xs truncate font-medium">{img.caption}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- LIGHTBOX MODAL --- */}
      {lightboxIndex !== -1 && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200" onClick={closeLightbox}>
            <button onClick={closeLightbox} className="absolute top-4 right-4 text-white/50 hover:text-white p-2 z-50 transition-colors">
                <X size={32} />
            </button>

            <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 rounded-full hover:bg-white/10 transition-all z-50 hidden md:block">
                <ChevronLeft size={40} />
            </button>
            <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 rounded-full hover:bg-white/10 transition-all z-50 hidden md:block">
                <ChevronRight size={40} />
            </button>

            <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                <img 
                    src={fullGallery[lightboxIndex].url} 
                    alt="Full View" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                />
                
                {/* Caption Bar */}
                {fullGallery[lightboxIndex].caption && (
                    <div className="mt-4 bg-white/10 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full text-white text-center max-w-2xl shadow-lg">
                        {fullGallery[lightboxIndex].caption}
                    </div>
                )}

                {/* Watermark */}
                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white/90 text-sm font-semibold pointer-events-none select-none">
                    © {story.authorName} | JourneysPage
                </div>

                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white/70 text-xs font-mono">
                    {lightboxIndex + 1} / {fullGallery.length}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- SUB COMPONENTS ---

const Badge = ({ icon, text, color }) => (
  text ? <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${color}`}>{icon} {text}</span> : null
);

const DetailCard = ({ icon, label, value, children, bg, border }) => (
    <div className={`p-3 rounded-xl border ${bg} ${border} flex items-center gap-3 transition-colors hover:brightness-95`}>
        <div className="p-2 bg-white rounded-lg shadow-sm text-slate-700">
            {icon}
        </div>
        <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">{label}</div>
            <div className="text-sm font-semibold text-slate-700 truncate">
                {children || value}
            </div>
        </div>
    </div>
);