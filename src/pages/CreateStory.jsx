import React, { useEffect, useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Save, Send,
  Camera, Image as ImageIcon, Loader2, AlertCircle,
  Youtube, Info, Lightbulb, Type, Check, X,
  ArrowLeft, Sun, Moon, ShieldCheck, AlertTriangle, Globe2
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
  return colors[name?.toLowerCase()] || '#94a3b8';
};

export default function CreateStory() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ⚡ PROCESSING ANIMATION STATE
  const [processingStatus, setProcessingStatus] = useState(null); // { current: 1, total: 5, type: 'Optimizing' }

  // ⚡ VALIDATION MODAL STATE
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // 🌓 THEME STATE
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  // ⚡ TOGGLE THEME EFFECT
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  /* -------- META OPTIONS -------- */
  const { options: tripTypes } = useMetaOptions("tripTypes");
  const { options: difficulties } = useMetaOptions("difficultyLevels");
  const { options: categories, loading: categoriesLoading } = useMetaOptions("categories");

  /* -------------------- STATE -------------------- */
  const [storyId, setStoryId] = useState(editId || null);
  
  // 1️⃣ ADD STATUS STATE
  const [storyStatus, setStoryStatus] = useState("draft"); // draft | pending | approved | returned
  
  // 3️⃣ DEFINE UI PERMISSIONS
  const isDraft = storyStatus === "draft";
  const isReturned = storyStatus === "returned";
  const isPending = storyStatus === "pending";
  const isApproved = storyStatus === "approved";

  // UI permissions
  const canEditAll = isDraft;
  const canFixReturned = isReturned;
  const isReadOnly = isPending || isApproved;
  // Alias for specific image logic requested
  const isImageLocked = isReadOnly; 

  const [trip, setTrip] = useState({
    title: "",
    location: "",
    month: "",
    totalCost: "",
    tripType: "",
    difficulty: "",
    category: "",
    aboutPlace: "",
    specialNote: "",
    enableYoutube: false,
    youtubeLink: "",
    coverImage: "",
    coverImageCaption: "",
    coverImageFile: null,
    coverImagePreview: null,
    gallery: [],
    days: [],
  });

  const [expandedDays, setExpandedDays] = useState([]);

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
        // 2️⃣ SET STATUS WHEN LOADING STORY
        setStoryStatus(data.status || "draft");

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
          if (typeof item === 'string') {
            return { url: item, caption: "", is360: false, file: null, preview: item };
          }
          return {
            url: item.url,
            caption: item.caption || "",
            is360: item.is360 || false,
            file: null,
            preview: item.url
          };
        });

        setTrip({
          title: data.title || "",
          location: data.location || "",
          month: data.month || "",
          totalCost: data.totalCost || "",
          tripType: data.tripType || "",
          difficulty: data.difficulty || "",
          category: data.category || "",
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

  /* -------------------- HELPERS & HANDLERS -------------------- */

  // ⚡ HIGH FIDELITY COMPRESSION
  const compressImage = async (file, type = 'standard') => {
    const thresholdMB = type === 'panorama' ? 6 : 2;
    if (file.size / 1024 / 1024 < thresholdMB) {
      return file;
    }

    let options = {
      maxSizeMB: 2,
      maxWidthOrHeight: 2560,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.90
    };

    if (type === 'panorama') {
      options = {
        maxSizeMB: 5,
        maxWidthOrHeight: 8192,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.95
      };
    }

    try {
      const compressedFile = await imageCompression(file, options);
      if (compressedFile.size > file.size) return file;
      return compressedFile;
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

  const handleDateChange = (e) => {
    const val = e.target.value;
    if (!val) return setTrip({ ...trip, month: "" });
    const [year, month] = val.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = `${monthNames[parseInt(month) - 1]}-${year}`;
    setTrip({ ...trip, month: formatted });
  };

  const getInputValueFromMonth = (monthStr) => {
    if (!monthStr || !monthStr.includes("-")) return "";
    const [mon, year] = monthStr.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = monthNames.indexOf(mon);
    if (monthIndex === -1) return "";
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  };

  const handleCoverImageChange = async (file) => {
    if (!file) return;
    if (!trip.coverImagePreview && totalImagesCount >= MAX_IMAGES) return alert(`Image limit reached (${MAX_IMAGES} total).`);

    setProcessingStatus({ current: 1, total: 1, type: "Processing Cover" });
    const compressedFile = await compressImage(file, 'standard');
    setTrip(p => ({ ...p, coverImageFile: compressedFile, coverImagePreview: URL.createObjectURL(compressedFile) }));
    setProcessingStatus(null);
  };

  const handleDayImageChange = async (index, file) => {
    if (!file) return;
    if (!trip.days[index].imagePreview && totalImagesCount >= MAX_IMAGES) return alert(`Image limit reached (${MAX_IMAGES} total).`);

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
    const existing360 = trip.gallery.find(img => img.is360);
    if (existing360) {
      return alert("You can only upload ONE 360° panorama per story.");
    }
    const filesArray = Array.from(files);
    if (filesArray.length > 1) {
      return alert("Please select only ONE 360° photo.");
    }
    if (filesArray.length > (MAX_IMAGES - totalImagesCount)) return alert(`Limit exceeded.`);

    setProcessingStatus({ current: 1, total: 1, type: "Processing 360° Panorama" });

    const newPhotos = await Promise.all(filesArray.map(async (file) => {
      const compressedFile = await compressImage(file, 'panorama');
      return { url: "", caption: "", is360: true, file: compressedFile, preview: URL.createObjectURL(compressedFile) };
    }));

    setTrip(p => ({ ...p, gallery: [...p.gallery, ...newPhotos] }));
    setProcessingStatus(null);
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

  const validateForPublish = () => {
    const errors = [];
    if (!trip.title?.trim()) errors.push("Story Title");
    if (!trip.location?.trim()) errors.push("Location");
    if (!trip.month) errors.push("Journey Month");
    if (!trip.totalCost) errors.push("Total Cost");
    if (!trip.tripType) errors.push("Trip Type");
    if (!trip.difficulty) errors.push("Difficulty");
    if (!trip.category) errors.push("Category");
    if (!trip.aboutPlace?.trim()) errors.push("About the Place");
    if (!trip.specialNote?.trim()) errors.push("Important Notes");
    if (!trip.coverImagePreview) errors.push("Cover Image");

    if (trip.days.length < 1) {
      errors.push("Minimum 1 Day entry");
    } else {
      const hasDayImage = trip.days.some(d => d.imagePreview);
      if (!hasDayImage) errors.push("At least one Day must have an image");
    }

    if (totalImagesCount < 5) {
      errors.push(`Minimum 5 images total (Cover + Days + Gallery). Current: ${totalImagesCount}`);
    }

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

    try {
      setIsSubmitting(true);
      setLoading(true);

      let activeId = storyId;
      if (!activeId) {
        const newDoc = await addDoc(collection(db, "stories"), {
          title: trip.title,
          location: trip.location,
          authorId: user.uid,
          authorName: userProfile?.name || "Explorer",

          status: "draft",
          published: false,

          revisionCount: 0,
          revisionHistory: [],
          adminNotes: "",

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        activeId = newDoc.id;
      }

      let coverUrl = trip.coverImage;
      if (trip.coverImageFile) {
        coverUrl = await uploadImage(`stories/${activeId}/cover.jpg`, trip.coverImageFile);
      }

      const finalGallery = [];
      for (let i = 0; i < trip.gallery.length; i++) {
        const item = trip.gallery[i];
        let itemUrl = item.url;
        if (item.file) itemUrl = await uploadImage(`stories/${activeId}/gallery/${Date.now()}-${i}.jpg`, item.file);

        finalGallery.push({
          url: itemUrl,
          caption: item.caption || "",
          is360: item.is360 || false
        });
      }

      await updateDoc(doc(db, "stories", activeId), {
        title: trip.title,
        location: trip.location,
        month: trip.month,
        totalCost: trip.totalCost,
        tripType: trip.tripType,
        difficulty: trip.difficulty,
        category: trip.category,
        aboutPlace: trip.aboutPlace,
        specialNote: trip.specialNote,
        youtubeLink: trip.enableYoutube ? trip.youtubeLink : "",
        authorId: user.uid,
        authorName: userProfile?.name || "Explorer",
        published: publish,
        status: publish ? 'pending' : 'draft',
        adminNotes: publish ? "" : (trip.adminNotes || ""),
        coverImage: coverUrl,
        coverImageCaption: trip.coverImageCaption || "",
        gallery: finalGallery,
        updatedAt: serverTimestamp(),
      });

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] transition-colors duration-300">

      {/* ⚡ FLOATING NAV CONTROLS */}
      <div className="fixed top-6 left-0 right-0 px-4 md:px-8 z-[90] flex justify-between items-center pointer-events-none">
        <button
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto p-3 rounded-full bg-white/80 dark:bg-black/20 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:scale-105 transition-all shadow-lg group"
          title="Go Back"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => setIsDark(!isDark)}
          className="pointer-events-auto p-3 rounded-full bg-white/80 dark:bg-black/20 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:rotate-12 transition-all shadow-lg"
          title="Toggle Theme"
        >
          {isDark ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} />}
        </button>
      </div>

      {/* ⚡ PROCESSING OVERLAY ANIMATION ⚡ */}
      <AnimatePresence>
        {processingStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
            <div className="relative w-24 h-24 mb-8">
              {/* Spinner Background */}
              <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
              {/* Spinner Active */}
              <div className="absolute inset-0 border-t-4 border-orange-500 rounded-full animate-spin"></div>
              {/* Icon */}
              <ImageIcon className="absolute inset-0 m-auto text-white/80 animate-pulse" size={32} />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">
              {processingStatus.type}...
            </h3>
            <p className="text-white/60 font-mono text-sm tracking-widest uppercase">
              Processing {processingStatus.current} of {processingStatus.total}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto pt-24 px-4 pb-20"
      >
        <div className="flex justify-between items-end mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            {editId ? "Edit Journey" : "New Journey"}
          </h1>
          <button onClick={() => navigate("/dashboard")} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium">
            Cancel
          </button>
        </div>

        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl space-y-8">

          {/* --- ESSENTIALS --- */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-orange-500 rounded-full" /> Trip Essentials
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputGroup
                label="Story Title"
                value={trip.title}
                disabled={isReadOnly}
                onChange={e => setTrip({ ...trip, title: e.target.value })}
                placeholder="e.g. Lost in Ladakh" />

              <InputGroup
                label="Location"
                value={trip.location}
                disabled={isReadOnly}
                onChange={e => setTrip({ ...trip, location: e.target.value })}
                placeholder="e.g. Leh, India" />

              <InputGroup
                label="Journey Month"
                value={getInputValueFromMonth(trip.month)}
                onChange={handleDateChange}
                disabled={isReadOnly}
                type="month"
              />

              <InputGroup
                label="Total Cost (₹) per person"
                value={trip.totalCost}
                onChange={e => setTrip({ ...trip, totalCost: e.target.value })}
                disabled={isReadOnly}
                placeholder="e.g. 15000"
                type="number"
                min="0"
                onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
              />

              <CustomSelect
                label="Trip Type"
                value={trip.tripType}
                onChange={(val) => setTrip({ ...trip, tripType: val })}
                options={tripTypes}
                disabled={isReadOnly}
                placeholder="Select Type..."
              />
              <CustomSelect
                label="Difficulty"
                value={trip.difficulty}
                onChange={(val) => setTrip({ ...trip, difficulty: val })}
                options={difficulties}
                disabled={isReadOnly}
                placeholder="Select Level..."
              />

              <CustomSelect
                label="Category"
                value={trip.category}
                onChange={(val) => setTrip({ ...trip, category: val })}
                options={categories}
                disabled={isReadOnly}
                placeholder="Select Category..."
              />
            </div>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- 🔔 MESSAGE BANNER (Added Here) --- */}
          {isPending && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 p-3 rounded-xl flex items-center gap-3 text-blue-800 dark:text-blue-200 text-sm">
                <span>🔒</span>
                <span>This story is under admin review. Image editing is locked.</span>
            </div>
          )}

          {/* --- COVER PHOTO --- */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
                <span className="w-1 h-6 bg-blue-500 rounded-full" /> Cover Photo
              </h2>
              <span className={`text-xs font-mono px-2 py-1 rounded border ${totalImagesCount >= MAX_IMAGES ? "border-red-500 text-red-500 bg-red-50" : "border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400"}`}>
                {totalImagesCount}/{MAX_IMAGES} Images
              </span>
            </div>

            <label className={`relative group block w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-white/10 transition-all shadow-inner ${isReadOnly ? "cursor-not-allowed border-slate-200 dark:border-white/5" : "hover:border-orange-500 dark:hover:border-orange-500/50 cursor-pointer"}`}>
              {/* 7️⃣ IMAGE UPLOAD LOCK UI */}
              {isReadOnly && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm font-bold z-10">
                  Editing Locked
                </div>
              )}

              {trip.coverImagePreview ? (
                <>
                  <img src={trip.coverImagePreview} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                  {!isReadOnly && (
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-sm text-white font-medium border border-white/10">
                      Change Cover
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 group-hover:text-orange-500 transition-colors">
                  <ImageIcon size={48} className="mb-4 opacity-50" />
                  <span className="text-lg font-medium">Upload Cover Image</span>
                  <span className="text-sm opacity-60">1920x1080 Recommended</span>
                </div>
              )}
              {/* 🛑 LOCKED INPUT */}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={isImageLocked}
                onChange={(e) => handleCoverImageChange(e.target.files[0])}
              />
            </label>

            {trip.coverImagePreview && (
              <div className="flex items-center gap-2">
                <Type size={16} className="text-slate-500" />
                <input
                  className="flex-1 bg-transparent border-b border-slate-200 dark:border-white/10 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="Add a caption for the cover photo..."
                  value={trip.coverImageCaption}
                  disabled={isReadOnly}
                  onChange={(e) => setTrip({ ...trip, coverImageCaption: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- ITINERARY --- */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-green-500 rounded-full" /> Day-by-Day Itinerary
            </h2>

            <div className="space-y-4">
              <AnimatePresence>
                {trip.days.map((day, index) => (
                  <motion.div
                    key={day.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden hover:border-slate-300 dark:hover:border-white/10 transition-all"
                  >
                    <div
                      onClick={() => setExpandedDays(p => p.includes(day.id) ? p.filter(d => d !== day.id) : [...p, day.id])}
                      className="p-4 flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/5">
                          {index + 1}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white/90">{day.title || `Day ${index + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {!isReadOnly && (
                          <button onClick={(e) => { e.stopPropagation(); removeDay(index); }} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full text-slate-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                        {expandedDays.includes(day.id) ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                      </div>
                    </div>

                    {expandedDays.includes(day.id) && (
                      <div className="p-4 pt-0 border-t border-slate-200 dark:border-white/5 grid md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Day Image */}
                        <div className="md:col-span-4 space-y-4">
                          <label className={`block aspect-[4/3] rounded-xl bg-slate-200 dark:bg-black/20 border border-slate-300 dark:border-white/5 overflow-hidden relative transition-all group/img ${isReadOnly ? "cursor-not-allowed" : "cursor-pointer hover:border-slate-400 dark:hover:border-white/20"}`}>
                            {day.imagePreview ? (
                              <>
                                <img src={day.imagePreview} alt="Day" className="w-full h-full object-cover" />
                                {!isReadOnly && (
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
                                )}
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Camera size={24} />
                                <span className="text-xs mt-2 font-medium">Image of the Day</span>
                              </div>
                            )}
                            {/* 🛑 LOCKED INPUT */}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              disabled={isImageLocked}
                              onChange={(e) => handleDayImageChange(index, e.target.files[0])}
                            />
                          </label>

                          {/* Day Caption */}
                          {day.imagePreview && (
                            <input
                              className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-green-500 transition-colors"
                              placeholder="Caption for this photo..."
                              value={day.imageCaption}
                              disabled={isReadOnly}
                              onChange={(e) => updateDay(index, "imageCaption", e.target.value)}
                            />
                          )}
                        </div>

                        {/* Day Form */}
                        <div className="md:col-span-8 space-y-4">
                          <InputGroup label="Title" value={day.title} disabled={isReadOnly} onChange={e => updateDay(index, "title", e.target.value)} placeholder="e.g. Trek to Summit" />
                          <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="From" value={day.departure} disabled={isReadOnly} onChange={e => updateDay(index, "departure", e.target.value)} />
                            <InputGroup label="To" value={day.destination} disabled={isReadOnly} onChange={e => updateDay(index, "destination", e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Stay" value={day.stay} disabled={isReadOnly} onChange={e => updateDay(index, "stay", e.target.value)} />
                            <InputGroup label="Food" value={day.food} disabled={isReadOnly} onChange={e => updateDay(index, "food", e.target.value)} />
                          </div>
                          <InputGroup label="Highlight" value={day.highlight} disabled={isReadOnly} onChange={e => updateDay(index, "highlight", e.target.value)} placeholder="Moment of the day..." />
                          <textarea
                            className={`w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-orange-500 transition-colors resize-y min-h-[150px] ${isReadOnly ? "opacity-70 cursor-not-allowed" : ""}`}
                            rows={6}
                            disabled={isReadOnly}
                            placeholder="Tell the story of this day... (Drag bottom-right corner to expand)"
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

            {!isReadOnly && (
              <button onClick={addDay} className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/40 transition-all flex items-center justify-center gap-2">
                <Plus size={18} /> Add Day {trip.days.length + 1}
              </button>
            )}
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- DETAILS & EXTRAS --- */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
                <span className="w-1 h-6 bg-yellow-500 rounded-full" /> About the Place
              </h2>
              <div className="relative">
                <div className="absolute top-4 left-4 text-yellow-500"><Info size={20} /></div>
                {/* 6️⃣ LOCK TEXTAREAS */}
                <textarea
                  value={trip.aboutPlace}
                  disabled={isReadOnly}
                  onChange={e => setTrip({ ...trip, aboutPlace: e.target.value })}
                  className={`w-full h-40 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-yellow-500 transition-colors resize-none ${isReadOnly ? "opacity-70 cursor-not-allowed" : ""}`}
                  placeholder="History, culture, or why this place is special..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
                <span className="w-1 h-6 bg-red-500 rounded-full" /> Important Notes
              </h2>
              <div className="relative">
                <div className="absolute top-4 left-4 text-red-500"><Lightbulb size={20} /></div>
                <textarea
                  className={`w-full h-40 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-red-500 transition-colors resize-none ${isReadOnly ? "opacity-70 cursor-not-allowed" : ""}`}
                  placeholder="Best time to visit, what to carry, safety tips, permits needed..."
                  value={trip.specialNote}
                  disabled={isReadOnly}
                  onChange={(e) => setTrip({ ...trip, specialNote: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- YOUTUBE --- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
                <span className="w-1 h-6 bg-red-600 rounded-full" /> YouTube Video
              </h2>
              <label className={`relative inline-flex items-center ${isReadOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={trip.enableYoutube}
                  disabled={isReadOnly}
                  onChange={(e) => setTrip({ ...trip, enableYoutube: e.target.checked })}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                <span className="ml-3 text-sm font-medium text-slate-500 dark:text-slate-300">Enable Video</span>
              </label>
            </div>

            {trip.enableYoutube && (
              <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <Youtube className="text-red-500" size={24} />
                  <input
                    type="text"
                    placeholder="Paste YouTube Video Link here (e.g., https://youtu.be/...)"
                    value={trip.youtubeLink}
                    disabled={isReadOnly}
                    onChange={(e) => setTrip({ ...trip, youtubeLink: e.target.value })}
                    className={`flex-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-red-500 ${isReadOnly ? "opacity-70 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-white/5" />

          {/* --- GALLERY --- */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white/90 flex items-center gap-2">
              <span className="w-1 h-6 bg-purple-500 rounded-full" /> Photo Gallery
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">

              {/* ⚡ STANDARD PHOTO BUTTON */}
              {!isReadOnly && (
                <label className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 hover:border-purple-500 dark:hover:border-purple-500/50 cursor-pointer flex flex-col items-center justify-center text-slate-400 dark:text-white/40 hover:text-purple-600 dark:hover:text-purple-400 transition-all">
                  <Plus size={24} className="mb-2" />
                  <span className="text-xs font-medium text-center px-2">Add Photo</span>
                  {/* 🛑 LOCKED INPUT */}
                  <input type="file" multiple accept="image/*" hidden disabled={isImageLocked} onChange={(e) => handleGalleryUpload(e.target.files)} />
                </label>
              )}

              {/* ⚡ 360 PHOTO BUTTON (Restricted) */}
              {!isReadOnly && (
                trip.gallery.some(img => img.is360) ? (
                  // DISABLED STATE (If 360 exists)
                  <div className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center text-slate-300 dark:text-white/20 cursor-not-allowed opacity-60">
                    <Globe2 size={24} className="mb-2" />
                    <span className="text-[10px] font-medium text-center px-2">360° Limit Reached</span>
                  </div>
                ) : (
                  // ACTIVE STATE
                  <label className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 hover:border-blue-500 dark:hover:border-blue-500/50 cursor-pointer flex flex-col items-center justify-center text-slate-400 dark:text-white/40 hover:text-blue-600 dark:hover:text-blue-400 transition-all">
                    <Globe2 size={24} className="mb-2" />
                    <span className="text-xs font-medium text-center px-2">Add 360° Photo</span>
                    {/* 🛑 LOCKED INPUT */}
                    <input type="file" accept="image/*" hidden disabled={isImageLocked} onChange={(e) => handle360Upload(e.target.files)} />
                  </label>
                )
              )}

              {/* Images Grid */}
              {trip.gallery.map((img, i) => (
                <div key={i} className="flex flex-col gap-2 relative group">
                  <div className={`relative aspect-square rounded-xl overflow-hidden border ${img.is360 ? "border-blue-500 shadow-md shadow-blue-500/20" : "border-slate-200 dark:border-white/10"}`}>
                    <img src={img.preview} alt="Gallery" className="w-full h-full object-cover" />

                    {/* DELETE BUTTON */}
                    {!isReadOnly && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => removeGalleryImage(i)} className="bg-red-500 p-1.5 rounded-full text-white hover:bg-red-600 shadow-sm">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}

                    {/* 360 BADGE (Only shows if it IS a 360 photo) */}
                    {img.is360 && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm">
                          <Globe2 size={12} className="animate-pulse" />
                          <span>360° Panorama</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Caption Input */}
                  <input
                    className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-purple-500 transition-colors text-center"
                    placeholder={img.is360 ? "Describe this view..." : "Caption..."}
                    value={img.caption}
                    disabled={isReadOnly}
                    onChange={(e) => updateGalleryCaption(i, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <AlertCircle size={12} />
              <span>Total {MAX_IMAGES} images allowed across Cover, Days, and Gallery.</span>
            </div>
          </div>

          <div className="h-4" />

          {/* --- 8️⃣ BUTTON LOGIC (SAVE / PUBLISH) --- */}
          {!isReadOnly && (
            <div className="grid grid-cols-2 gap-4 sticky bottom-4 z-20">
              <button
                onClick={() => submitStory(false)}
                disabled={isSubmitting}
                className="py-4 rounded-xl bg-white dark:bg-[#1A1F2E] text-slate-900 dark:text-white font-medium border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#252b3d] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Draft
              </button>
              <button
                onClick={() => submitStory(true)}
                disabled={isSubmitting}
                className="py-4 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold hover:shadow-orange-500/20 hover:scale-[1.02] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                {isReturned ? "Resubmit for Review" : "Publish Story"}
              </button>
            </div>
          )}

          {isReadOnly && (
            <div className="text-center text-sm text-slate-500 italic pb-6">
              This story is locked while under review.
            </div>
          )}

        </div>
      </motion.div>

      {/* ⚡ CUSTOM VALIDATION MODAL ⚡ */}
      <AnimatePresence>
        {showValidationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowValidationModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl overflow-hidden"
            >
              {/* Decorative Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-4 relative z-10">

                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-2">
                  <AlertTriangle size={32} className="text-orange-500" />
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Action Required</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Please complete these fields to publish:</p>
                </div>

                {/* Error List */}
                <div className="w-full bg-slate-50 dark:bg-black/20 rounded-xl p-4 text-left border border-slate-100 dark:border-white/5 max-h-60 overflow-y-auto custom-scrollbar">
                  <ul className="space-y-2">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => setShowValidationModal(false)}
                  className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-[#0B0F19] font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                >
                  Okay, I'll Fix It
                </button>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ⚡ UPDATED COMPONENTS with Light/Dark support

const CustomSelect = ({ label, value, onChange, options, placeholder, disabled }) => {
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`
            w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-left flex items-center justify-between text-slate-900 dark:text-white transition-colors focus:outline-none
            ${disabled
            ? "opacity-70 cursor-not-allowed bg-slate-200 dark:bg-white/5"
            : "hover:border-orange-500"
          }
        `}
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
          <span className="text-slate-400 dark:text-white/30">{placeholder}</span>
        )}
        <ChevronDown size={16} className={`text-slate-400 dark:text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
            >
              {safeOptions.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  No options found.
                  <br />(Check Admin Panel)
                </div>
              ) : (
                safeOptions.map(option => (
                  <button
                    key={option.id || option.label}
                    type="button"
                    onClick={() => {
                      // Prefer Value if available (Categories), else Label (TripTypes)
                      onChange(option.value || option.label);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-white/5 last:border-0"
                  >
                    {option.icon && (
                      <div style={{ color: getColorHex(option.color) }}>
                        {renderIcon(option.icon)}
                      </div>
                    )}
                    <span className={`flex-1 ${option.label === value || option.value === value ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                      {option.label}
                    </span>
                    {(option.label === value || option.value === value) && <Check size={16} className="text-orange-500" />}
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

// 5️⃣ UPDATE InputGroup COMPONENT (BOTTOM)
const InputGroup = ({ label, value, onChange, placeholder, type = "text", disabled, min, onKeyDown }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      onKeyDown={onKeyDown}
      className={`
        w-full rounded-xl px-4 py-3
        ${disabled
          ? "bg-slate-200 dark:bg-white/5 cursor-not-allowed opacity-70"
          : "bg-slate-100 dark:bg-black/20 focus:border-orange-500 focus:outline-none"}
      `}
    />
  </div>
);