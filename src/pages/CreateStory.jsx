import React, { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Save, Send,
  Camera, Image as ImageIcon, Loader2, AlertCircle,
  Youtube, Type, ArrowLeft, Sun, Moon, AlertTriangle, Globe2, Lock, Edit3, CheckCircle2, Hammer
} from "lucide-react";
import * as LucideIcons from "lucide-react";
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
  orderBy,
  increment // ⚡ IMPORTED INCREMENT
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import imageCompression from 'browser-image-compression';

import { db, storage } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useMetaOptions } from "../hooks/useMetaOptions";
import { sendNotification } from "../services/notificationService";
import LocationPicker from "../components/ui/LocationPicker";

// --- HELPER: Get Color Hex from Name ---
const getColorHex = (name) => {
  const colors = {
    slate: '#64748b', red: '#ef4444', orange: '#f97316', amber: '#f59e0b',
    yellow: '#eab308', lime: '#84cc16', green: '#22c55e', emerald: '#10b981',
    teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6',
    indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef',
    pink: '#ec4899', rose: '#f43f5e'
  };
  return colors[name?.toLowerCase()] || '#94a3b8';
};

export default function CreateStory() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null); 
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // ⚡ TRACK MODIFIED FIELDS (The "Amber" State)
  const [modifiedFields, setModifiedFields] = useState({});

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) { root.classList.add("dark"); localStorage.setItem("theme", "dark"); } 
    else { root.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [isDark]);

  const { options: tripTypes } = useMetaOptions("tripTypes");
  const { options: difficulties } = useMetaOptions("difficultyLevels");
  const { options: categories } = useMetaOptions("categories");

  const [storyId, setStoryId] = useState(editId || null);
  const [storyStatus, setStoryStatus] = useState("draft"); 
  const [feedback, setFeedback] = useState({}); 

  const isReturned = storyStatus === "returned";
    
  // ⚡ HELPER: Mark a field as "Modified" by the user
  const trackChange = (field) => {
      if (isReturned && feedback[field]) {
          setModifiedFields(prev => ({ ...prev, [field]: true }));
      }
  };

  // ⚡ SMART LOCK: Only allow editing flagged fields if returned
  const isFieldLocked = (fieldName) => {
    if (storyStatus === "draft") return false;
    if (storyStatus === "pending" || storyStatus === "approved") return true;
    
    if (storyStatus === "returned") {
        // If feedback exists for this field, it is UNLOCKED.
        return !feedback[fieldName];
    }
    return false; 
  };

  const [trip, setTrip] = useState({
    title: "", 
    location: "", 
    locationData: null, // Added for LocationPicker
    month: "", totalCost: "",
    tripType: "", difficulty: "", category: "",
    aboutPlace: "", specialNote: "",
    enableYoutube: false, youtubeLink: "",
    coverImage: "", coverImageCaption: "", coverImageFile: null, coverImagePreview: null,
    gallery: [], days: [],
  });

  const [expandedDays, setExpandedDays] = useState([]);

  const totalImagesCount =
    (trip.coverImagePreview ? 1 : 0) +
    trip.days.filter(d => d.imagePreview).length +
    trip.gallery.length;

  const MAX_IMAGES = 15;

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
        setStoryStatus(data.status || "draft");
        setStoryId(editId); 
        
        if (data.feedback) setFeedback(data.feedback);
        
        if (data.modifiedFlags) {
            setModifiedFields(data.modifiedFlags);
        }

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

        const galleryData = (data.gallery || []).map(item => {
          if (typeof item === 'string') return { url: item, caption: "", is360: false, file: null, preview: item };
          return { url: item.url, caption: item.caption || "", is360: item.is360 || false, file: null, preview: item.url };
        });

        setTrip({
          title: data.title || "", 
          location: data.location || "",
          locationData: data.locationData || null, // Load location data
          month: data.month || "", totalCost: data.totalCost || "",
          tripType: data.tripType || "", difficulty: data.difficulty || "", category: data.category || "",
          aboutPlace: data.aboutPlace || "", specialNote: data.specialNote || "",
          youtubeLink: data.youtubeLink || "", enableYoutube: !!data.youtubeLink,
          coverImage: data.coverImage || "", coverImageCaption: data.coverImageCaption || "", coverImagePreview: data.coverImage || null, coverImageFile: null,
          gallery: galleryData, days: days.length ? days : [],
        });

        // Auto-expand flagged days
        const daysWithErrors = days.filter(d => data.feedback && data.feedback[`day_${d.dayNumber}`]).map(d => d.id);
        if (daysWithErrors.length > 0) {
            setExpandedDays(daysWithErrors);
        } else if (days.length > 0) {
            setExpandedDays([days[0].id]);
        }

      } catch (e) {
        console.error("Edit load failed:", e);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    loadStoryForEdit();
  }, [editId, user, navigate]);

  const compressImage = async (file, type = 'standard') => {
    const thresholdMB = type === 'panorama' ? 6 : 2;
    if (file.size / 1024 / 1024 < thresholdMB) return file;
    let options = { maxSizeMB: 2, maxWidthOrHeight: 2560, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.90 };
    if (type === 'panorama') options = { maxSizeMB: 5, maxWidthOrHeight: 8192, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.95 };
    try { return await imageCompression(file, options); } catch (error) { return file; }
  };

  const uploadImage = async (path, file) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleDateChange = (e) => {
    trackChange('month'); // Matches Admin 'meta' flag
    const val = e.target.value;
    if (!val) return setTrip({ ...trip, month: "" });
    const [year, month] = val.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    setTrip({ ...trip, month: `${monthNames[parseInt(month) - 1]}-${year}` });
  };

  const getInputValueFromMonth = (monthStr) => {
    if (!monthStr || !monthStr.includes("-")) return "";
    const [mon, year] = monthStr.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = monthNames.indexOf(mon);
    if (monthIndex === -1) return "";
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  };

  // ⚡ HANDLER: Location Picker
  const handleLocationSelect = (selectedOption) => {
    trackChange('location'); // Track modification
    
    // selectedOption is null if user clears the input
    if (!selectedOption) {
        setTrip(prev => ({ ...prev, location: "", locationData: null }));
        return;
    }
    
    setTrip(prev => ({
        ...prev,
        location: selectedOption.label.split(",")[0], // Just the city name for display (e.g. "Sandakphu")
        locationData: selectedOption // Save full data for stats
    }));
  };

  const handleCoverImageChange = async (file) => {
    if (isFieldLocked('coverImage')) return; 
    trackChange('coverImage'); 
    if (!file) return;
    setProcessingStatus({ current: 1, total: 1, type: "Processing Cover" });
    const compressedFile = await compressImage(file, 'standard');
    setTrip(p => ({ ...p, coverImageFile: compressedFile, coverImagePreview: URL.createObjectURL(compressedFile) }));
    setProcessingStatus(null);
  };

  const handleDayImageChange = async (index, file) => {
    if (!file) return;
    trackChange(`day_${trip.days[index].dayNumber}`);
    setProcessingStatus({ current: 1, total: 1, type: "Processing Day" });
    const compressedFile = await compressImage(file, 'standard');
    const days = [...trip.days];
    days[index].imageFile = compressedFile;
    days[index].imagePreview = URL.createObjectURL(compressedFile);
    setTrip(p => ({ ...p, days }));
    setProcessingStatus(null);
  };

  const handleGalleryUpload = async (files) => {
    if (!files) return;
    trackChange('gallery');
    const filesArray = Array.from(files);
    if (filesArray.length > (MAX_IMAGES - totalImagesCount)) return alert(`Limit exceeded.`);
    setProcessingStatus({ current: 0, total: filesArray.length, type: "Optimizing Photos" });
    const newPhotos = [];
    for (let i = 0; i < filesArray.length; i++) {
      setProcessingStatus({ current: i + 1, total: filesArray.length, type: "Optimizing Photos" });
      const compressedFile = await compressImage(filesArray[i], 'standard');
      newPhotos.push({ url: "", caption: "", is360: false, file: compressedFile, preview: URL.createObjectURL(compressedFile) });
    }
    setTrip(p => ({ ...p, gallery: [...p.gallery, ...newPhotos] }));
    setProcessingStatus(null);
  };

  const handle360Upload = async (files) => {
    if (!files) return;
    trackChange('gallery');
    const existing360 = trip.gallery.find(img => img.is360);
    if (existing360) return alert("You can only upload ONE 360° panorama per story.");
    const filesArray = Array.from(files);
    if (filesArray.length > 1) return alert("Please select only ONE 360° photo.");
    
    setProcessingStatus({ current: 1, total: 1, type: "Processing 360° Panorama" });
    const newPhotos = await Promise.all(filesArray.map(async (file) => {
      const compressedFile = await compressImage(file, 'panorama');
      return { url: "", caption: "", is360: true, file: compressedFile, preview: URL.createObjectURL(compressedFile) };
    }));
    setTrip(p => ({ ...p, gallery: [...p.gallery, ...newPhotos] }));
    setProcessingStatus(null);
  };

  const updateGalleryCaption = (index, text) => { 
    trackChange('gallery'); 
    const newGallery = [...trip.gallery]; newGallery[index].caption = text; setTrip(p => ({ ...p, gallery: newGallery })); 
  };
  const removeGalleryImage = (index) => { trackChange('gallery'); setTrip(p => ({ ...p, gallery: p.gallery.filter((_, i) => i !== index) })); };
  const removeDayImage = (index) => { 
      trackChange(`day_${trip.days[index].dayNumber}`);
      const days = [...trip.days]; days[index].imageFile = null; days[index].imagePreview = null; days[index].imageUrl = ""; days[index].imageCaption = ""; setTrip(p => ({ ...p, days })); 
  };
  const addDay = () => { 
      const id = trip.days.length + 1; setTrip(p => ({ ...p, days: [...p.days, { id, title: "", story: "", departure: "", destination: "", food: "", stay: "", travel: "", highlight: "", imageFile: null, imagePreview: null, imageCaption: "" }] })); setExpandedDays([id]); 
  };
  const updateDay = (index, field, value) => { 
      trackChange(`day_${trip.days[index].dayNumber}`);
      const days = [...trip.days]; days[index][field] = value; setTrip(p => ({ ...p, days })); 
  };
  const removeDay = (index) => { const days = trip.days.filter((_, i) => i !== index); setTrip(p => ({ ...p, days })); };

  const validateForPublish = () => {
    const errors = [];
    if (!trip.title?.trim()) errors.push("Story Title");
    if (!trip.location?.trim()) errors.push("Location");
    if (!trip.days.length) errors.push("Minimum 1 Day");
    return errors;
  };

  const submitStory = async (publish) => {
    if (isSubmitting) return;
    if (!trip.title.trim()) return alert("Story title is required!");

    if (publish) {
        const errors = validateForPublish();
        if (errors.length > 0) {
            setValidationErrors(errors);
            setShowValidationModal(true);
            return;
        }
    }

    let targetStatus = 'draft';
    let isPublished = false;

    if (publish) {
        targetStatus = 'pending';
        isPublished = true;
    } else {
        if (storyStatus === 'returned') {
            targetStatus = 'returned';
        }
    }

    try {
      setIsSubmitting(true);
      setLoading(true);

      let activeId = storyId; 
      
      if (!activeId) {
        const newDoc = await addDoc(collection(db, "stories"), { 
            title: trip.title, location: trip.location, authorId: user.uid,
            status: "draft", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            revisionCount: 0, revisionHistory: []
        });
        activeId = newDoc.id;
        setStoryId(activeId); 
      }

      let coverUrl = trip.coverImage;
      if (trip.coverImageFile) coverUrl = await uploadImage(`stories/${activeId}/cover.jpg`, trip.coverImageFile);

      const finalGallery = [];
      for (let i = 0; i < trip.gallery.length; i++) {
        const item = trip.gallery[i];
        let itemUrl = item.url;
        if (item.file) itemUrl = await uploadImage(`stories/${activeId}/gallery/${Date.now()}-${i}.jpg`, item.file);
        finalGallery.push({ url: itemUrl, caption: item.caption || "", is360: item.is360 || false });
      }

      const updatePayload = {
        title: trip.title, 
        location: trip.location, 
        locationData: trip.locationData || null, // Save Location Data
        month: trip.month, totalCost: trip.totalCost,
        tripType: trip.tripType, difficulty: trip.difficulty, category: trip.category,
        aboutPlace: trip.aboutPlace, specialNote: trip.specialNote,
        youtubeLink: trip.enableYoutube ? trip.youtubeLink : "",
        authorId: user.uid, authorName: userProfile?.name || "Explorer",
        published: isPublished,
        status: targetStatus,
        coverImage: coverUrl, coverImageCaption: trip.coverImageCaption || "",
        gallery: finalGallery, updatedAt: serverTimestamp(),
        modifiedFlags: modifiedFields 
      };

      // ⚡ TRACK REVISIONS AUTOMATICALLY
      if (publish || isReturned) {
          updatePayload.revisionCount = increment(1);
      }

      // 1. Update the Main Story Document
      await updateDoc(doc(db, "stories", activeId), updatePayload);

      // ⚡ ADDED: NOTIFICATION LOGIC
      // If this is a publish action or a resubmission (isReturned), notify Admin
      if (publish || isReturned) {
          await sendNotification({
              recipientId: 'admin', // Send to Admin Dashboard
              type: 'info',
              title: 'Story Revision Submitted',
              message: `${userProfile?.name || 'An author'} has updated "${trip.title}". Revision #${(trip.revisionCount || 0) + 1}.`,
              link: `/admin` // Or specific review link
          });
      }

      // 2. Wipe and Replace "Days" Sub-collection
      const oldDays = await getDocs(collection(db, "stories", activeId, "days"));
      const deletePromises = oldDays.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // 3. Add New Days
      for (let i = 0; i < trip.days.length; i++) {
        let dayImg = trip.days[i].imagePreview; 
        if (trip.days[i].imageFile) {
            dayImg = await uploadImage(`stories/${activeId}/days/day-${i + 1}-${Date.now()}.jpg`, trip.days[i].imageFile);
        }
        
        await addDoc(collection(db, "stories", activeId, "days"), { 
            title: trip.days[i].title, story: trip.days[i].story, 
            departure: trip.days[i].departure, destination: trip.days[i].destination,
            food: trip.days[i].food, stay: trip.days[i].stay, highlight: trip.days[i].highlight,
            imageUrl: dayImg || "", imageCaption: trip.days[i].imageCaption || "", dayNumber: i + 1, 
        });
      }

      navigate("/dashboard");
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  if (loading) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] flex items-center justify-center">
            <Loader2 className="animate-spin text-orange-500" size={32} />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] transition-colors duration-300">
      <div className="fixed top-6 left-0 right-0 px-4 md:px-8 z-[90] flex justify-between items-center pointer-events-none">
        <button onClick={() => navigate("/dashboard")} className="pointer-events-auto p-3 rounded-full bg-white/80 dark:bg-black/20 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:scale-105 transition-all shadow-lg group">
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <button onClick={() => setIsDark(!isDark)} className="pointer-events-auto p-3 rounded-full bg-white/80 dark:bg-black/20 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:rotate-12 transition-all shadow-lg">
          {isDark ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {processingStatus && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-orange-500 rounded-full animate-spin"></div>
              <ImageIcon className="absolute inset-0 m-auto text-white/80 animate-pulse" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">{processingStatus.type}...</h3>
            <p className="text-white/60 font-mono text-sm tracking-widest uppercase">Processing {processingStatus.current} of {processingStatus.total}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto pt-24 px-4 pb-20">
        <div className="flex justify-between items-end mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            {isReturned ? "Fix & Resubmit" : editId ? "Edit Journey" : "New Journey"}
          </h1>
          <button onClick={() => navigate("/dashboard")} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium">Cancel</button>
        </div>

        {/* 🛑 STATIC REVISION BANNER */}
        {isReturned && (
            <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={24} className="text-red-500"/>
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Admin Requested Changes</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">Please address the flagged sections marked in red below. Unaffected fields are locked to help you focus.</p>
                </div>
                <div className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg text-sm shrink-0">
                    Needs Action
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl space-y-8">

          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-orange-500 rounded-full" /> Trip Essentials
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputGroup label="Story Title" value={trip.title} disabled={isFieldLocked('title')} onChange={e => {setTrip({ ...trip, title: e.target.value }); trackChange('title');}} placeholder="e.g. Lost in Ladakh" feedback={feedback['title']} isModified={modifiedFields['title']} />
              
              {/* ⚡ REPLACED: NEW LOCATION PICKER with Feedback Wrapper */}
              <div className="space-y-1">
                <div className="flex justify-between">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">Location</label>
                </div>
                <LocationPicker 
                    value={trip.locationData} 
                    onChange={handleLocationSelect}
                    disabled={isFieldLocked('location')}
                />
                {/* ⚡ SMART FEEDBACK MESSAGE FOR LOCATION */}
                {feedback['location'] && (
                    <div className={`text-xs p-2 rounded-lg border flex items-start gap-2 mt-1 ${modifiedFields['location'] ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-500/20' : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-500/20'}`}>
                        {modifiedFields['location'] ? <CheckCircle2 size={14} className="mt-0.5 shrink-0"/> : <AlertCircle size={14} className="mt-0.5 shrink-0"/>}
                        <span><span className="font-bold">{modifiedFields['location'] ? 'Change Detected:' : 'Correction Needed:'}</span> {modifiedFields['location'] ? 'Save to submit this fix.' : feedback['location']}</span>
                    </div>
                )}
              </div>
              
              <InputGroup label="Journey Month" value={getInputValueFromMonth(trip.month)} onChange={handleDateChange} disabled={isFieldLocked('month')} type="month" feedback={feedback['month']} isModified={modifiedFields['month']} />
              <InputGroup label="Total Cost (₹)" value={trip.totalCost} onChange={e => {setTrip({ ...trip, totalCost: e.target.value }); trackChange('cost');}} disabled={isFieldLocked('cost')} placeholder="e.g. 15000" type="number" feedback={feedback['cost']} isModified={modifiedFields['cost']} />
              
              <CustomSelect label="Trip Type" value={trip.tripType} onChange={(val) => {setTrip({ ...trip, tripType: val }); trackChange('tripType');}} options={tripTypes} disabled={isFieldLocked('tripType')} placeholder="Select Type..." feedback={feedback['tripType']} isModified={modifiedFields['tripType']} />
              <CustomSelect label="Difficulty" value={trip.difficulty} onChange={(val) => {setTrip({ ...trip, difficulty: val }); trackChange('difficulty');}} options={difficulties} disabled={isFieldLocked('difficulty')} placeholder="Select Level..." feedback={feedback['difficulty']} isModified={modifiedFields['difficulty']} />
              <CustomSelect label="Category" value={trip.category} onChange={(val) => {setTrip({ ...trip, category: val }); trackChange('category');}} options={categories} disabled={isFieldLocked('category')} placeholder="Select Category..." feedback={feedback['category']} isModified={modifiedFields['category']} />
            </div>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- COVER PHOTO --- */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
                <span className="w-1 h-6 bg-blue-500 rounded-full" /> Cover Photo
              </h2>
            </div>

            <label className={`relative group block w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border-2 border-dashed transition-all shadow-inner 
                ${isFieldLocked('coverImage') ? "cursor-not-allowed border-slate-200 dark:border-white/5 opacity-60" : "hover:border-orange-500 cursor-pointer border-slate-300 dark:border-white/10"}
                ${feedback['coverImage'] ? (modifiedFields['coverImage'] ? "border-amber-500 ring-2 ring-amber-500/20" : "border-red-500 ring-2 ring-red-500/20") : ""}
            `}>
              {isFieldLocked('coverImage') && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm font-bold z-10"><Lock size={16} className="mr-2"/> Locked</div>}
              {trip.coverImagePreview ? (
                <><img src={trip.coverImagePreview} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />{!isFieldLocked('coverImage') && <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-sm text-white font-medium border border-white/10">Change Cover</div>}</>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 group-hover:text-orange-500 transition-colors"><ImageIcon size={48} className="mb-4 opacity-50" /><span className="text-lg font-medium">Upload Cover</span></div>
              )}
              <input type="file" accept="image/*" hidden disabled={isFieldLocked('coverImage')} onChange={(e) => handleCoverImageChange(e.target.files[0])} />
            </label>
            
            {feedback['coverImage'] && (
                <div className={`border rounded-xl p-3 flex items-start gap-3 ${modifiedFields['coverImage'] ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20'}`}>
                    {modifiedFields['coverImage'] ? <CheckCircle2 className="text-amber-500 shrink-0 mt-0.5" size={18} /> : <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />}
                    <div className={`text-sm ${modifiedFields['coverImage'] ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        <span className="font-bold block mb-0.5">{modifiedFields['coverImage'] ? 'Modification Detected:' : 'Admin Feedback:'}</span>
                        {modifiedFields['coverImage'] ? 'You have updated this field. Save to resubmit.' : feedback['coverImage']}
                    </div>
                </div>
            )}
            
            {trip.coverImagePreview && !isFieldLocked('coverImage') && (
                <div className="flex items-center gap-2">
                    <Type size={16} className="text-slate-500" />
                    <input className="flex-1 bg-transparent border-b border-slate-200 dark:border-white/10 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-orange-500 transition-colors" placeholder="Add a caption..." value={trip.coverImageCaption} onChange={(e) => setTrip({ ...trip, coverImageCaption: e.target.value })} />
                </div>
            )}
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- ITINERARY --- */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-green-500 rounded-full" /> Itinerary
            </h2>
            <div className="space-y-4">
              <AnimatePresence>
                {trip.days.map((day, index) => {
                    const dayKey = `day_${day.dayNumber}`;
                    const isDayLocked = isFieldLocked(dayKey);
                    const dayFeedback = feedback[dayKey];
                    const isModified = modifiedFields[dayKey];

                    return (
                        <motion.div key={day.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`group bg-slate-50 dark:bg-slate-900/50 border rounded-2xl overflow-hidden transition-all ${dayFeedback ? (isModified ? "border-amber-500 ring-1 ring-amber-500/20" : "border-red-500 ring-1 ring-red-500/20") : "border-slate-200 dark:border-white/5"} ${isDayLocked && isReturned ? "opacity-60 grayscale-[50%]" : ""}`}>
                            <div onClick={() => setExpandedDays(p => p.includes(day.id) ? p.filter(d => d !== day.id) : [...p, day.id])} className="p-4 flex items-center justify-between cursor-pointer select-none">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center text-sm font-bold">{index + 1}</div>
                                    <span className="font-medium text-slate-900 dark:text-white/90">{day.title || `Day ${index + 1}`}</span>
                                    {isDayLocked && isReturned && <Lock size={14} className="text-slate-400"/>}
                                    {dayFeedback && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse ${isModified ? 'text-amber-600 bg-amber-100 dark:bg-amber-500/10' : 'text-red-500 bg-red-100 dark:bg-red-500/10'}`}>
                                            {isModified ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>} 
                                            {isModified ? 'Modified' : 'Needs Fix'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {!isDayLocked && <button onClick={(e) => { e.stopPropagation(); removeDay(index); }} className="p-2 hover:bg-red-500/20 rounded-full text-slate-500"><Trash2 size={16} /></button>}
                                    {expandedDays.includes(day.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </div>

                            {expandedDays.includes(day.id) && (
                                <div className="p-4 pt-0 border-t border-slate-200 dark:border-white/5 grid md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-2 duration-200 relative">
                                    {dayFeedback && (
                                        <div className={`md:col-span-12 mb-2 border rounded-xl p-3 flex items-start gap-3 ${isModified ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20' : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20'}`}>
                                            {isModified ? <CheckCircle2 className="text-amber-500 shrink-0 mt-0.5" size={18} /> : <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />}
                                            <div className={`text-sm ${isModified ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                                <span className="font-bold block mb-0.5">{isModified ? 'Change Detected:' : 'Correction Required:'}</span>
                                                {isModified ? 'You have modified this day. It will be marked for review upon submission.' : dayFeedback}
                                            </div>
                                        </div>
                                    )}

                                    {isDayLocked && <div className="absolute inset-0 bg-slate-50/10 z-10 cursor-not-allowed"></div>}
                                    
                                    <div className="md:col-span-4 space-y-4">
                                        <label className={`block aspect-[4/3] rounded-xl bg-slate-200 dark:bg-black/20 border overflow-hidden relative ${!isDayLocked ? "cursor-pointer hover:border-slate-400" : ""}`}>
                                            {day.imagePreview ? <img src={day.imagePreview} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center justify-center h-full text-slate-500"><Camera size={24} /></div>}
                                            <input type="file" accept="image/*" hidden disabled={isDayLocked} onChange={(e) => handleDayImageChange(index, e.target.files[0])} />
                                        </label>
                                        {day.imagePreview && <input className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white" placeholder="Caption..." value={day.imageCaption} disabled={isDayLocked} onChange={(e) => updateDay(index, "imageCaption", e.target.value)} />}
                                    </div>
                                    <div className="md:col-span-8 space-y-4">
                                        <InputGroup label="Title" value={day.title} disabled={isDayLocked} onChange={e => updateDay(index, "title", e.target.value)} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputGroup label="From" value={day.departure} disabled={isDayLocked} onChange={e => updateDay(index, "departure", e.target.value)} />
                                            <InputGroup label="To" value={day.destination} disabled={isDayLocked} onChange={e => updateDay(index, "destination", e.target.value)} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputGroup label="Stay" value={day.stay} disabled={isDayLocked} onChange={e => updateDay(index, "stay", e.target.value)} />
                                            <InputGroup label="Food" value={day.food} disabled={isDayLocked} onChange={e => updateDay(index, "food", e.target.value)} />
                                        </div>
                                        <InputGroup label="Highlight" value={day.highlight} disabled={isDayLocked} onChange={e => updateDay(index, "highlight", e.target.value)} placeholder="Moment of the day..." />
                                        <textarea className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white resize-y min-h-[150px]" rows={6} disabled={isDayLocked} value={day.story} onChange={e => updateDay(index, "story", e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
              </AnimatePresence>
            </div>
            {!isReturned && !isFieldLocked('all') && (
              <button onClick={addDay} className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-slate-500 hover:bg-slate-100 flex items-center justify-center gap-2"><Plus size={18} /> Add Day</button>
            )}
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- DETAILS --- */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2"><span className="w-1 h-6 bg-yellow-500 rounded-full" /> About the Place</h2>
              <div className="relative">
                {feedback['aboutPlace'] && (
                    <div className={`mb-2 border rounded-xl p-3 flex items-start gap-3 ${modifiedFields['aboutPlace'] ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20'}`}>
                        {modifiedFields['aboutPlace'] ? <CheckCircle2 className="text-amber-500 shrink-0 mt-0.5" size={16} /> : <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />}
                        <div className={`text-sm ${modifiedFields['aboutPlace'] ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                            <span className="font-bold block">{modifiedFields['aboutPlace'] ? 'Modification Detected:' : 'Admin Note:'}</span> {modifiedFields['aboutPlace'] ? 'Save to submit.' : feedback['aboutPlace']}
                        </div>
                    </div>
                )}
                <textarea value={trip.aboutPlace} disabled={isFieldLocked('aboutPlace')} onChange={e => {setTrip({ ...trip, aboutPlace: e.target.value }); trackChange('aboutPlace');}} className={`w-full h-40 bg-slate-100 dark:bg-black/20 border rounded-xl p-4 pl-4 text-slate-900 dark:text-white resize-none ${feedback['aboutPlace'] ? (modifiedFields['aboutPlace'] ? "border-amber-500 ring-1 ring-amber-500/20" : "border-red-500 ring-1 ring-red-500/20") : "border-slate-200 dark:border-white/10"} ${isFieldLocked('aboutPlace') ? "cursor-not-allowed opacity-60" : ""}`} />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2"><span className="w-1 h-6 bg-red-500 rounded-full" /> Pro Tips</h2>
              <div className="relative">
                {feedback['specialNote'] && (
                    <div className={`mb-2 border rounded-xl p-3 flex items-start gap-3 ${modifiedFields['specialNote'] ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20'}`}>
                        {modifiedFields['specialNote'] ? <CheckCircle2 className="text-amber-500 shrink-0 mt-0.5" size={16} /> : <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />}
                        <div className={`text-sm ${modifiedFields['specialNote'] ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                            <span className="font-bold block">{modifiedFields['specialNote'] ? 'Modification Detected:' : 'Admin Note:'}</span> {modifiedFields['specialNote'] ? 'Save to submit.' : feedback['specialNote']}
                        </div>
                    </div>
                )}
                <textarea value={trip.specialNote} disabled={isFieldLocked('specialNote')} onChange={e => {setTrip({ ...trip, specialNote: e.target.value }); trackChange('specialNote');}} className={`w-full h-40 bg-slate-100 dark:bg-black/20 border rounded-xl p-4 pl-4 text-slate-900 dark:text-white resize-none ${feedback['specialNote'] ? (modifiedFields['specialNote'] ? "border-amber-500 ring-1 ring-amber-500/20" : "border-red-500 ring-1 ring-red-500/20") : "border-slate-200 dark:border-white/10"} ${isFieldLocked('specialNote') ? "cursor-not-allowed opacity-60" : ""}`} />
              </div>
            </div>
          </div>

           <div className="w-full h-px bg-slate-200 dark:bg-white/5" />
           <div className="space-y-4">
             <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2"><span className="w-1 h-6 bg-red-600 rounded-full" /> YouTube Video</h2><label className={`relative inline-flex items-center ${isFieldLocked('youtube') ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}><input type="checkbox" className="sr-only peer" checked={trip.enableYoutube} disabled={isFieldLocked('youtube')} onChange={(e) => setTrip({ ...trip, enableYoutube: e.target.checked })} /><div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div><span className="ml-3 text-sm font-medium text-slate-500 dark:text-slate-300">Enable Video</span></label></div>
             {trip.enableYoutube && (<div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2"><div className="flex items-center gap-3"><Youtube className="text-red-500" size={24} /><input type="text" placeholder="Paste YouTube Video Link here..." value={trip.youtubeLink} disabled={isFieldLocked('youtube')} onChange={(e) => setTrip({ ...trip, youtubeLink: e.target.value })} className={`flex-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-red-500 ${isFieldLocked('youtube') ? "opacity-70 cursor-not-allowed" : ""}`}/></div></div>)}
           </div>
          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- GALLERY & VIDEO --- */}
          <div className="space-y-4">
             <div className="flex justify-between items-center"><h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2"><span className="w-1 h-6 bg-purple-500 rounded-full" /> Photo Gallery</h2>{feedback['gallery'] && <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 animate-pulse ${modifiedFields['gallery'] ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10' : 'bg-red-100 text-red-500 dark:bg-red-500/10'}`}>{modifiedFields['gallery'] ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>} {modifiedFields['gallery'] ? 'Modified' : 'Needs Fix'}</span>}</div>
             
             {feedback['gallery'] && (
                <div className={`mb-4 border rounded-xl p-3 flex items-start gap-3 ${modifiedFields['gallery'] ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20'}`}>
                    {modifiedFields['gallery'] ? <CheckCircle2 className="text-amber-500 shrink-0 mt-0.5" size={16} /> : <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />}
                    <div className={`text-sm ${modifiedFields['gallery'] ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        <span className="font-bold block">{modifiedFields['gallery'] ? 'Modification Detected:' : 'Admin Feedback:'}</span> {modifiedFields['gallery'] ? 'Changes tracked. Save to resubmit.' : feedback['gallery']}
                    </div>
                </div>
             )}

             <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 rounded-xl border ${feedback['gallery'] ? (modifiedFields['gallery'] ? 'border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10' : 'border-red-500 ring-1 ring-red-500/20 bg-red-50/50 dark:bg-red-900/10') : 'border-transparent'} ${isFieldLocked('gallery') ? "opacity-60 grayscale-[50%]" : ""}`}>
                {!isFieldLocked('gallery') && (<label className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 hover:border-purple-500 dark:hover:border-purple-500/50 cursor-pointer flex flex-col items-center justify-center text-slate-400 dark:text-white/40 hover:text-purple-600 dark:hover:text-purple-400 transition-all"><Plus size={24} className="mb-2" /><span className="text-xs font-medium text-center px-2">Add Photo</span><input type="file" multiple accept="image/*" hidden onChange={(e) => handleGalleryUpload(e.target.files)} /></label>)}
                {!isFieldLocked('gallery') && (trip.gallery.some(img => img.is360) ? (<div className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center text-slate-300 dark:text-white/20 cursor-not-allowed opacity-60"><Globe2 size={24} className="mb-2" /><span className="text-[10px] font-medium text-center px-2">360° Limit Reached</span></div>) : (<label className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 hover:border-blue-500 dark:hover:border-blue-500/50 cursor-pointer flex flex-col items-center justify-center text-slate-400 dark:text-white/40 hover:text-blue-600 dark:hover:text-blue-400 transition-all"><Globe2 size={24} className="mb-2" /><span className="text-xs font-medium text-center px-2">Add 360° Photo</span><input type="file" accept="image/*" hidden onChange={(e) => handle360Upload(e.target.files)} /></label>))}
                {trip.gallery.map((img, i) => (<div key={i} className="flex flex-col gap-2 relative group"><div className={`relative aspect-square rounded-xl overflow-hidden border ${img.is360 ? "border-blue-500 shadow-md shadow-blue-500/20" : "border-slate-200 dark:border-white/10"}`}><img src={img.preview} alt="Gallery" className="w-full h-full object-cover" />{!isFieldLocked('gallery') && (<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => removeGalleryImage(i)} className="bg-red-500 p-1.5 rounded-full text-white hover:bg-red-600 shadow-sm"><Trash2 size={14} /></button></div>)}{img.is360 && (<div className="absolute bottom-2 left-2 right-2"><div className="bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm"><Globe2 size={12} className="animate-pulse" /><span>360° Panorama</span></div></div>)}</div><input className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-purple-500 transition-colors text-center" placeholder={img.is360 ? "Describe view..." : "Caption..."} value={img.caption} disabled={isFieldLocked('gallery')} onChange={(e) => updateGalleryCaption(i, e.target.value)} /></div>))}
             </div>
          </div>

          <div className="h-4" />

          {storyStatus !== "pending" && storyStatus !== "approved" && (
            <div className="grid grid-cols-2 gap-4 sticky bottom-4 z-20">
              <button onClick={() => submitStory(false)} disabled={isSubmitting} className="py-4 rounded-xl bg-white dark:bg-[#1A1F2E] text-slate-600 dark:text-white font-medium border border-slate-200 dark:border-white/10 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center gap-2 shadow-lg transition-colors">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Draft
              </button>
              <button onClick={() => submitStory(true)} disabled={isSubmitting} className={`py-4 rounded-xl text-white font-bold hover:shadow-orange-500/20 hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg ${isReturned ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' : 'bg-gradient-to-r from-orange-600 to-orange-500'}`}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                {isReturned ? "Submit Revisions" : "Publish Story"}
              </button>
            </div>
          )}

        </div>
      </motion.div>

       <AnimatePresence>
        {showValidationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowValidationModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-2"><AlertTriangle size={32} className="text-orange-500" /></div>
                <div><h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Action Required</h3><p className="text-slate-500 dark:text-slate-400 text-sm">Please complete these fields to publish:</p></div>
                <div className="w-full bg-slate-50 dark:bg-black/20 rounded-xl p-4 text-left border border-slate-100 dark:border-white/5 max-h-60 overflow-y-auto custom-scrollbar"><ul className="space-y-2">{validationErrors.map((err, i) => (<li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" /><span>{err}</span></li>))}</ul></div>
                <button onClick={() => setShowValidationModal(false)} className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-[#0B0F19] font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">Okay, I'll Fix It</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ⚡ SMART INPUT GROUP
const InputGroup = ({ label, value, onChange, placeholder, type = "text", disabled, min, onKeyDown, feedback, isModified }) => (
  <div className="space-y-1">
    <div className="flex justify-between">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">{label}</label>
    </div>
    <div className="relative">
        <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} min={min} onKeyDown={onKeyDown}
        className={`w-full rounded-xl px-4 py-3 transition-all
            ${disabled ? "bg-slate-200 dark:bg-white/5 cursor-not-allowed opacity-70 border-transparent" : "bg-slate-100 dark:bg-black/20 focus:outline-none focus:border-orange-500 border border-slate-200 dark:border-white/5"}
            ${feedback ? (isModified ? "border-amber-500 ring-1 ring-amber-500/20" : "border-red-500 ring-1 ring-red-500/20") : ""}
        `}
        />
        {disabled && <Lock size={14} className="absolute right-4 top-3.5 text-slate-400"/>}
    </div>
    {/* ⚡ SMART FEEDBACK MESSAGE */}
    {feedback && (
        <div className={`text-xs p-2 rounded-lg border flex items-start gap-2 mt-1 ${isModified ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-500/20' : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-500/20'}`}>
            {isModified ? <CheckCircle2 size={14} className="mt-0.5 shrink-0"/> : <AlertCircle size={14} className="mt-0.5 shrink-0"/>}
            <span><span className="font-bold">{isModified ? 'Change Detected:' : 'Correction Needed:'}</span> {isModified ? 'Save to submit this fix.' : feedback}</span>
        </div>
    )}
  </div>
);

// ⚡ CUSTOM SELECT
const CustomSelect = ({ label, value, onChange, options, placeholder, disabled, feedback, isModified }) => {
  const [isOpen, setIsOpen] = useState(false);
  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find(o => o.value === value || o.label === value);

  const renderIcon = (iconName) => {
    if (!iconName) return null;
    const IconComponent = LucideIcons[iconName];
    return IconComponent ? <IconComponent size={16} /> : null;
  };

  return (
    <div className={`space-y-1 relative ${isOpen ? "z-50" : "z-0"}`}>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">{label}</label>
      <button type="button" disabled={disabled} onClick={() => setIsOpen(!isOpen)} 
        className={`w-full bg-slate-100 dark:bg-black/20 border rounded-xl px-4 py-3 text-left flex items-center justify-between text-slate-900 dark:text-white transition-colors focus:outline-none 
        ${disabled ? "opacity-70 cursor-not-allowed bg-slate-200 dark:bg-white/5 border-slate-200 dark:border-white/10" : "hover:border-orange-500 border-slate-200 dark:border-white/10"}
        ${feedback ? (isModified ? "border-amber-500 ring-1 ring-amber-500/20" : "border-red-500 ring-1 ring-red-500/20") : ""}
      `}>
        {selectedOption ? (<div className="flex items-center gap-2">{selectedOption.icon && (<div style={{ color: getColorHex(selectedOption.color) }}>{renderIcon(selectedOption.icon)}</div>)}<span>{selectedOption.label}</span></div>) : (<span className="text-slate-400 dark:text-white/30">{placeholder}</span>)}<ChevronDown size={16} className={`text-slate-400 dark:text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* ⚡ SMART FEEDBACK MESSAGE FOR SELECT */}
      {feedback && (
        <div className={`text-xs p-2 rounded-lg border flex items-start gap-2 mt-1 ${isModified ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-500/20' : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-500/20'}`}>
            {isModified ? <CheckCircle2 size={14} className="mt-0.5 shrink-0"/> : <AlertCircle size={14} className="mt-0.5 shrink-0"/>}
            <span><span className="font-bold">{isModified ? 'Change Detected:' : 'Correction Needed:'}</span> {isModified ? 'Save to submit this fix.' : feedback}</span>
        </div>
      )}

      <AnimatePresence>
        {isOpen && !disabled && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
              {safeOptions.length === 0 ? (<div className="p-4 text-center text-slate-500 text-sm">No options found.</div>) : (safeOptions.map(opt => (<button key={opt.id || opt.label} type="button" onClick={() => { onChange(opt.value || opt.label); setIsOpen(false); }} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-white/5 last:border-0">{opt.icon && (<div style={{ color: getColorHex(opt.color) }}>{renderIcon(opt.icon)}</div>)}<span className={`flex-1 ${opt.label === value || opt.value === value ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400'}`}>{opt.label}</span>{(opt.label === value || opt.value === value) && <CheckCircle2 size={16} className="text-orange-500" />}</button>)))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};