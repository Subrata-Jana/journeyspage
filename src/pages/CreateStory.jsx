import React, { useEffect, useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Save, Send,
  Camera, Image as ImageIcon, Loader2, AlertCircle,
  Youtube, Info, Lightbulb, Type, Check, X
} from "lucide-react";
import * as LucideIcons from "lucide-react"; // ⚡ Import for dynamic icons
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import imageCompression from 'browser-image-compression';

import { db, storage } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useMetaOptions } from "../hooks/useMetaOptions";

// --- HELPER: Get Color Hex from Name ---
const getColorHex = (name) => {
  const colors = {
    slate: '#64748b', red: '#ef4444', orange: '#f97316', amber: '#f59e0b',
    yellow: '#eab308', lime: '#84cc16', green: '#22c55e', emerald: '#10b981',
    teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6',
    indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef',
    pink: '#ec4899', rose: '#f43f5e'
  };
  return colors[name] || '#94a3b8';
};

export default function CreateStory() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* -------- META OPTIONS -------- */
  const { options: tripTypes } = useMetaOptions("tripTypes");
  const { options: difficulties } = useMetaOptions("difficultyLevels");

  /* -------------------- STATE -------------------- */
  const [storyId, setStoryId] = useState(editId || null);

  const [trip, setTrip] = useState({
    title: "",
    location: "",
    month: "",
    totalCost: "",
    tripType: "",
    difficulty: "",
    aboutPlace: "",
    specialNote: "",
    enableYoutube: false,
    youtubeLink: "",
    
    // Cover
    coverImage: "", 
    coverImageCaption: "", 
    coverImageFile: null,
    coverImagePreview: null,
    
    // Gallery
    gallery: [], 
    days: [],
  });

  const [expandedDays, setExpandedDays] = useState([]);

  // 🔢 CALCULATE TOTAL IMAGES
  const totalImagesCount = 
    (trip.coverImagePreview ? 1 : 0) + 
    trip.days.filter(d => d.imagePreview).length + 
    trip.gallery.length;

  const MAX_IMAGES = 15;

  /* -------------------- LOAD FOR EDIT -------------------- */
  useEffect(() => {
    if (!editId || !user?.uid) return;

    async function loadStoryForEdit() {
      try {
        setLoading(true);
        const storyRef = doc(db, "stories", editId);
        const storySnap = await getDoc(storyRef);

        if (!storySnap.exists() || storySnap.data().authorId !== user.uid) {
          navigate("/dashboard");
          return;
        }

        const data = storySnap.data();

        // Load Days
        const daysRef = collection(db, "stories", editId, "days");
        const daysQuery = query(daysRef, orderBy("dayNumber", "asc"));
        const daysSnap = await getDocs(daysQuery);
        const days = daysSnap.docs.map((d, i) => ({
            id: i + 1,
            ...d.data(),
            imagePreview: d.data().imageUrl || null, 
            imageCaption: d.data().imageCaption || "",
            imageFile: null
        }));

        // Load Gallery
        const galleryData = (data.gallery || []).map(item => {
          if (typeof item === 'string') {
            return { url: item, caption: "", file: null, preview: item };
          }
          return { url: item.url, caption: item.caption || "", file: null, preview: item.url };
        });

        setTrip({
          title: data.title || "",
          location: data.location || "",
          month: data.month || "",
          totalCost: data.totalCost || "",
          tripType: data.tripType || "",
          difficulty: data.difficulty || "",
          aboutPlace: data.aboutPlace || "",
          specialNote: data.specialNote || "",
          youtubeLink: data.youtubeLink || "",
          enableYoutube: !!data.youtubeLink,
          
          coverImage: data.coverImage || "", 
          coverImageCaption: data.coverImageCaption || "",
          coverImagePreview: data.coverImage || null,
          coverImageFile: null,
          gallery: galleryData,
          days: days.length ? days : [],
        });

        setExpandedDays(days.map(d => d.id));
      } catch (e) {
        console.error("Edit load failed:", e);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadStoryForEdit();
  }, [editId, user, navigate]);

  /* -------------------- HELPERS -------------------- */
  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/jpeg"
    };
    try {
      if (file.size / 1024 / 1024 < 1) return file;
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Compression error:", error);
      return file; 
    }
  };

  const uploadImage = async (path, file) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  /* -------------------- HANDLERS -------------------- */
  const handleCoverImageChange = async (file) => {
    if (!file) return;
    if (!trip.coverImagePreview && totalImagesCount >= MAX_IMAGES) return alert(`Image limit reached (${MAX_IMAGES} total).`);
    const compressedFile = await compressImage(file);
    setTrip(p => ({ ...p, coverImageFile: compressedFile, coverImagePreview: URL.createObjectURL(compressedFile) }));
  };

  const handleDayImageChange = async (index, file) => {
    if (!file) return;
    if (!trip.days[index].imagePreview && totalImagesCount >= MAX_IMAGES) return alert(`Image limit reached (${MAX_IMAGES} total).`);
    const compressedFile = await compressImage(file);
    const days = [...trip.days];
    days[index].imageFile = compressedFile;
    days[index].imagePreview = URL.createObjectURL(compressedFile);
    setTrip(p => ({ ...p, days }));
  };

  const handleGalleryUpload = async (files) => {
    if (!files) return;
    const filesArray = Array.from(files);
    if (filesArray.length > (MAX_IMAGES - totalImagesCount)) return alert(`Limit exceeded.`);
    
    const newPhotos = await Promise.all(filesArray.map(async (file) => {
        const compressedFile = await compressImage(file);
        return { url: "", caption: "", file: compressedFile, preview: URL.createObjectURL(compressedFile) };
    }));
    setTrip(p => ({ ...p, gallery: [...p.gallery, ...newPhotos] }));
  };

  const updateGalleryCaption = (index, text) => {
    const newGallery = [...trip.gallery];
    newGallery[index].caption = text;
    setTrip(p => ({ ...p, gallery: newGallery }));
  };

  const removeGalleryImage = (index) => {
    setTrip(p => ({ ...p, gallery: p.gallery.filter((_, i) => i !== index) }));
  };

  const removeDayImage = (index) => {
    const days = [...trip.days];
    days[index].imageFile = null;
    days[index].imagePreview = null;
    days[index].imageUrl = ""; 
    days[index].imageCaption = "";
    setTrip(p => ({ ...p, days }));
  };

  const addDay = () => {
    const id = trip.days.length + 1;
    setTrip(p => ({ ...p, days: [...p.days, { id, title: "", story: "", departure: "", destination: "", food: "", stay: "", travel: "", highlight: "", imageFile: null, imagePreview: null, imageCaption: "" }] }));
    setExpandedDays([id]);
  };

  const updateDay = (index, field, value) => {
    const days = [...trip.days];
    days[index][field] = value;
    setTrip(p => ({ ...p, days }));
  };

  const removeDay = (index) => {
    const days = trip.days.filter((_, i) => i !== index);
    setTrip(p => ({ ...p, days }));
  };

  /* -------------------- SUBMIT -------------------- */
  const submitStory = async (publish) => {
    if (isSubmitting) return;
    if (!trip.title.trim()) return alert("Story title is required!");

    try {
      setIsSubmitting(true);
      setLoading(true);

      let activeId = storyId;
      if (!activeId) {
          const newDoc = await addDoc(collection(db, "stories"), { 
              createdAt: serverTimestamp(),
              authorId: user.uid 
          });
          activeId = newDoc.id;
      }

      // Upload Cover
      let coverUrl = trip.coverImage;
      if (trip.coverImageFile) {
        coverUrl = await uploadImage(`stories/${activeId}/cover.jpg`, trip.coverImageFile);
      }

      // Upload Gallery
      const finalGallery = [];
      for (let i = 0; i < trip.gallery.length; i++) {
        const item = trip.gallery[i];
        let itemUrl = item.url;
        if (item.file) itemUrl = await uploadImage(`stories/${activeId}/gallery/${Date.now()}-${i}.jpg`, item.file);
        finalGallery.push({ url: itemUrl, caption: item.caption || "" });
      }

      // Update Main Doc
      await updateDoc(doc(db, "stories", activeId), {
        title: trip.title, 
        location: trip.location, 
        month: trip.month, 
        totalCost: trip.totalCost,
        tripType: trip.tripType, 
        difficulty: trip.difficulty, 
        aboutPlace: trip.aboutPlace, 
        specialNote: trip.specialNote,
        youtubeLink: trip.enableYoutube ? trip.youtubeLink : "", 
        authorId: user.uid,
        authorName: userProfile?.name || "Explorer", 
        
        // ⚡ KEY FIXES START HERE ⚡
        published: publish,
        // If publishing, force status to 'pending' so it appears in Admin Panel
        // If saving draft, keep it as 'draft' or current status
        status: publish ? 'pending' : 'draft', 
        // Clear old admin notes so the badge disappears
        adminNotes: publish ? "" : (trip.adminNotes || ""), 
        // ⚡ KEY FIXES END HERE ⚡

        coverImage: coverUrl, 
        coverImageCaption: trip.coverImageCaption || "",
        gallery: finalGallery, 
        updatedAt: serverTimestamp(),
      });

      // Update Days
      const oldDays = await getDocs(collection(db, "stories", activeId, "days"));
      await Promise.all(oldDays.docs.map(d => deleteDoc(d.ref)));

      for (let i = 0; i < trip.days.length; i++) {
        let dayImg = trip.days[i].imagePreview;
        if (trip.days[i].imageFile) {
          dayImg = await uploadImage(`stories/${activeId}/days/day-${i + 1}.jpg`, trip.days[i].imageFile);
        }

        await addDoc(collection(db, "stories", activeId, "days"), {
          title: trip.days[i].title || "", story: trip.days[i].story || "",
          departure: trip.days[i].departure || "", destination: trip.days[i].destination || "",
          food: trip.days[i].food || "", stay: trip.days[i].stay || "",
          travel: trip.days[i].travel || "", highlight: trip.days[i].highlight || "",
          imageUrl: dayImg || "", imageCaption: trip.days[i].imageCaption || "",
          dayNumber: i + 1,
        });
      }

      navigate("/dashboard");
    } catch (e) {
      console.error(e);
      alert("Error saving story: " + e.message);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F19] to-black px-4 py-8 md:py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto"
      >
        <div className="flex justify-between items-end mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            {editId ? "Edit Journey" : "New Journey"}
          </h1>
          <button onClick={() => navigate("/dashboard")} className="text-slate-400 hover:text-white text-sm">
            Cancel
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
          
          {/* --- ESSENTIALS --- */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-orange-500 rounded-full"/> Trip Essentials
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputGroup label="Story Title" value={trip.title} onChange={e => setTrip({...trip, title: e.target.value})} placeholder="e.g. Lost in Ladakh" />
              <InputGroup label="Location" value={trip.location} onChange={e => setTrip({...trip, location: e.target.value})} placeholder="e.g. Leh, India" />
              <InputGroup label="When?" value={trip.month} onChange={e => setTrip({...trip, month: e.target.value})} placeholder="e.g. Oct 2025" />
              <InputGroup label="Total Cost (₹)" value={trip.totalCost} onChange={e => setTrip({...trip, totalCost: e.target.value})} placeholder="e.g. 15000" />
              
              {/* ⚡ PREMIUM CUSTOM SELECTS */}
              <CustomSelect 
                label="Trip Type" 
                value={trip.tripType} 
                onChange={(val) => setTrip({...trip, tripType: val})} 
                options={tripTypes} 
                placeholder="Select Type..."
              />
              <CustomSelect 
                label="Difficulty" 
                value={trip.difficulty} 
                onChange={(val) => setTrip({...trip, difficulty: val})} 
                options={difficulties} 
                placeholder="Select Level..."
              />
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* --- COVER PHOTO --- */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                <span className="w-1 h-6 bg-blue-500 rounded-full"/> Cover Photo
              </h2>
              <span className={`text-xs font-mono px-2 py-1 rounded border ${totalImagesCount >= MAX_IMAGES ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-white/10 text-slate-400"}`}>
                 {totalImagesCount}/{MAX_IMAGES} Images
              </span>
            </div>
            
            <label className="relative group block w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden bg-slate-900 border-2 border-dashed border-white/10 hover:border-orange-500/50 transition-all cursor-pointer shadow-inner">
              {trip.coverImagePreview ? (
                <>
                  <img src={trip.coverImagePreview} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-sm text-white font-medium border border-white/10">
                    Change Cover
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 group-hover:text-orange-400 transition-colors">
                  <ImageIcon size={48} className="mb-4 opacity-50" />
                  <span className="text-lg font-medium">Upload Cover Image</span>
                  <span className="text-sm opacity-60">1920x1080 Recommended</span>
                </div>
              )}
              <input type="file" accept="image/*" hidden onChange={(e) => handleCoverImageChange(e.target.files[0])} />
            </label>
            
            {trip.coverImagePreview && (
               <div className="flex items-center gap-2">
                  <Type size={16} className="text-slate-500"/>
                  <input 
                    className="flex-1 bg-transparent border-b border-white/10 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                    placeholder="Add a caption for the cover photo..."
                    value={trip.coverImageCaption}
                    onChange={(e) => setTrip({...trip, coverImageCaption: e.target.value})}
                  />
               </div>
            )}
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* --- ITINERARY --- */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-green-500 rounded-full"/> Day-by-Day Itinerary
            </h2>

            <div className="space-y-4">
              <AnimatePresence>
                {trip.days.map((day, index) => (
                  <motion.div 
                    key={day.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all"
                  >
                    <div 
                      onClick={() => setExpandedDays(p => p.includes(day.id) ? p.filter(d => d !== day.id) : [...p, day.id])}
                      className="p-4 flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-white/80 border border-white/5">
                          {index + 1}
                        </div>
                        <span className="font-medium text-white/90">{day.title || `Day ${index + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); removeDay(index); }} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full text-slate-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                        {expandedDays.includes(day.id) ? <ChevronUp size={18} className="text-slate-500"/> : <ChevronDown size={18} className="text-slate-500"/>}
                      </div>
                    </div>

                    {expandedDays.includes(day.id) && (
                      <div className="p-4 pt-0 border-t border-white/5 grid md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Day Image */}
                        <div className="md:col-span-4 space-y-4">
                          <label className="block aspect-[4/3] rounded-xl bg-black/20 border border-white/5 overflow-hidden relative cursor-pointer hover:border-white/20 transition-all group/img">
                            {day.imagePreview ? (
                              <>
                                <img src={day.imagePreview} alt="Day" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeDayImage(index);
                                  }}
                                  className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-red-500 transition"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Camera size={24} />
                                <span className="text-xs mt-2 font-medium">Image of the Day</span>
                              </div>
                            )}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleDayImageChange(index, e.target.files[0])} />
                          </label>

                          {/* Day Caption */}
                          {day.imagePreview && (
                            <input 
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-green-500/50 transition-colors"
                                placeholder="Caption for this photo..."
                                value={day.imageCaption}
                                onChange={(e) => updateDay(index, "imageCaption", e.target.value)}
                            />
                          )}
                        </div>

                        {/* Day Form */}
                        <div className="md:col-span-8 space-y-4">
                           <InputGroup label="Title" value={day.title} onChange={e => updateDay(index, "title", e.target.value)} placeholder="e.g. Trek to Summit" />
                           <div className="grid grid-cols-2 gap-4">
                              <InputGroup label="From" value={day.departure} onChange={e => updateDay(index, "departure", e.target.value)} />
                              <InputGroup label="To" value={day.destination} onChange={e => updateDay(index, "destination", e.target.value)} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <InputGroup label="Stay" value={day.stay} onChange={e => updateDay(index, "stay", e.target.value)} />
                              <InputGroup label="Food" value={day.food} onChange={e => updateDay(index, "food", e.target.value)} />
                           </div>
                           <InputGroup label="Highlight" value={day.highlight} onChange={e => updateDay(index, "highlight", e.target.value)} placeholder="Moment of the day..." />
                           <textarea 
                             className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                             rows={3}
                             placeholder="Tell the story of this day..."
                             value={day.story}
                             onChange={e => updateDay(index, "story", e.target.value)}
                           />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <button onClick={addDay} className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/50 hover:bg-white/5 hover:text-white hover:border-white/40 transition-all flex items-center justify-center gap-2">
              <Plus size={18} /> Add Day {trip.days.length + 1}
            </button>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* --- DETAILS & EXTRAS --- */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                 <span className="w-1 h-6 bg-yellow-500 rounded-full"/> About the Place
               </h2>
               <div className="relative">
                 <div className="absolute top-4 left-4 text-yellow-500"><Info size={20}/></div>
                 <textarea
                   className="w-full h-40 bg-black/20 border border-white/10 rounded-xl p-4 pl-12 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500/50 transition-colors resize-none"
                   placeholder="Hidden gems, local food, culture, or what makes this place special..."
                   value={trip.aboutPlace}
                   onChange={(e) => setTrip({...trip, aboutPlace: e.target.value})}
                 />
               </div>
            </div>

            <div className="space-y-4">
               <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                 <span className="w-1 h-6 bg-red-500 rounded-full"/> Important Notes
               </h2>
               <div className="relative">
                 <div className="absolute top-4 left-4 text-red-500"><Lightbulb size={20}/></div>
                 <textarea
                   className="w-full h-40 bg-black/20 border border-white/10 rounded-xl p-4 pl-12 text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                   placeholder="Best time to visit, what to carry, safety tips, permits needed..."
                   value={trip.specialNote}
                   onChange={(e) => setTrip({...trip, specialNote: e.target.value})}
                 />
               </div>
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* --- YOUTUBE --- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                <span className="w-1 h-6 bg-red-600 rounded-full"/> YouTube Video
              </h2>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={trip.enableYoutube}
                  onChange={(e) => setTrip({...trip, enableYoutube: e.target.checked})}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                <span className="ml-3 text-sm font-medium text-slate-300">Enable Video</span>
              </label>
            </div>

            {trip.enableYoutube && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <Youtube className="text-red-500" size={24} />
                  <input 
                    type="text"
                    placeholder="Paste YouTube Video Link here (e.g., https://youtu.be/...)"
                    value={trip.youtubeLink}
                    onChange={(e) => setTrip({...trip, youtubeLink: e.target.value})}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* --- GALLERY (With Captions) --- */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-purple-500 rounded-full"/> Photo Gallery
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Upload Button */}
              <label className="aspect-[4/5] rounded-xl border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer flex flex-col items-center justify-center text-white/40 hover:text-purple-400 transition-all">
                <Plus size={24} className="mb-2"/>
                <span className="text-xs font-medium text-center px-2">Add Extra Photos</span>
                <input type="file" multiple accept="image/*" hidden onChange={(e) => handleGalleryUpload(e.target.files)} />
              </label>

              {/* Images Grid */}
              {trip.gallery.map((img, i) => (
                <div key={i} className="flex flex-col gap-2">
                    <div className="relative aspect-square rounded-xl overflow-hidden group border border-white/10">
                    <img src={img.preview} alt="Gallery" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => removeGalleryImage(i)} className="bg-red-500/80 p-2 rounded-full text-white hover:bg-red-600 transition-colors">
                        <Trash2 size={16} />
                        </button>
                    </div>
                    </div>
                    {/* Gallery Caption */}
                    <input 
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 transition-colors text-center"
                        placeholder="Caption..."
                        value={img.caption}
                        onChange={(e) => updateGalleryCaption(i, e.target.value)}
                    />
                </div>
              ))}
            </div>
            
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <AlertCircle size={12}/>
              <span>Total {MAX_IMAGES} images allowed across Cover, Days, and Gallery.</span>
            </div>
          </div>

          <div className="h-4" />

          {/* --- ACTIONS --- */}
          <div className="grid grid-cols-2 gap-4 sticky bottom-4 z-20">
             <button 
               onClick={() => submitStory(false)} 
               disabled={isSubmitting}
               className="py-4 rounded-xl bg-[#1A1F2E] text-white font-medium border border-white/10 hover:bg-[#252b3d] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
             >
               {isSubmitting ? <Loader2 className="animate-spin"/> : <Save size={18} />} Save Draft
             </button>
             <button 
               onClick={() => submitStory(true)} 
               disabled={isSubmitting}
               className="py-4 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold hover:shadow-orange-500/20 hover:scale-[1.02] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
             >
               {isSubmitting ? <Loader2 className="animate-spin"/> : <Send size={18} />} Publish Story
             </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

/* --- UI COMPONENTS --- */

// ⚡ PREMIUM CUSTOM SELECT: Renders Icon + Color + Label + Z-Index Fix
const CustomSelect = ({ label, value, onChange, options, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Ensure options is an array to prevent crashes
    const safeOptions = Array.isArray(options) ? options : [];
    const selectedOption = safeOptions.find(o => o.label === value);

    const renderIcon = (iconName) => {
        if (!iconName) return null;
        const IconComponent = LucideIcons[iconName];
        return IconComponent ? <IconComponent size={16} /> : null;
    };

    return (
        // 🔴 FIX: Dynamic z-index ensures dropdown floats ABOVE other elements
        <div className={`space-y-1 relative ${isOpen ? "z-50" : "z-0"}`}>
            <label className="text-xs font-medium text-slate-400 ml-1">{label}</label>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-left flex items-center justify-between text-white hover:border-orange-500/50 transition-colors focus:outline-none"
            >
                {selectedOption ? (
                    <div className="flex items-center gap-2">
                         {selectedOption.icon && (
                            <div style={{ color: getColorHex(selectedOption.color) }}>
                                {renderIcon(selectedOption.icon)}
                            </div>
                         )}
                         <span>{selectedOption.label}</span>
                    </div>
                ) : (
                    <span className="text-white/30">{placeholder}</span>
                )}
                <ChevronDown size={16} className={`text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop to close when clicking outside */}
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#1A1F2E] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
                        >
                            {safeOptions.length === 0 ? (
                                <div className="p-4 text-center text-slate-500 text-sm">
                                    No options found. 
                                    <br/>(Check Admin Panel)
                                </div>
                            ) : (
                                safeOptions.map(option => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => { onChange(option.label); setIsOpen(false); }}
                                        className="w-full px-4 py-3 text-left hover:bg-white/5 flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
                                    >
                                        {option.icon && (
                                            <div style={{ color: getColorHex(option.color) }}>
                                                {renderIcon(option.icon)}
                                            </div>
                                        )}
                                        <span className={`flex-1 ${option.label === value ? 'text-white font-bold' : 'text-slate-400'}`}>
                                            {option.label}
                                        </span>
                                        {option.label === value && <Check size={16} className="text-orange-500"/>}
                                    </button>
                                ))
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

const InputGroup = ({ label, value, onChange, placeholder }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-400 ml-1">{label}</label>
    <input 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
    />
  </div>
);