import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "../services/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  Camera, MapPin, Award, Edit2, Globe, BookOpen, Heart, 
  Share2, Shield, Save, User, Link as LinkIcon, ArrowLeft,
  Facebook, Instagram, Youtube, Twitter, Gem, Lock, Eye, Copy
} from "lucide-react";
import { motion } from "framer-motion";
import toast, { Toaster } from 'react-hot-toast';

// ⚡ PREMIUM IMPORTS
import { useGamification, RenderIcon } from "../hooks/useGamification";
import LevelBadge from "../components/premium/LevelBadge";
import LevelProgress from "../components/premium/LevelProgress";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Profile Data
  const [profileData, setProfileData] = useState({
    name: "",
    bio: "",
    location: "",
    website: "",
    photoURL: "",
    coverURL: "",
    facebook: "",
    instagram: "",
    youtube: "",
    twitter: "",
    xp: 0,
    badges: [],
    inventory: [] 
  });

  // Stats
  const [stats, setStats] = useState({ stories: 0, likes: 0, views: 0, shares: 0, countries: 0 });

  // ⚡ INIT GAMIFICATION HOOK
  const { currentRank, badges, loot, loading: gameLoading } = useGamification(profileData.xp, profileData.badges, profileData.inventory);

  // Load Data
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        // 1. Fetch User Profile
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfileData({
            name: data.name || user.displayName || "Traveler",
            bio: data.bio || "Exploring the world, one story at a time.",
            location: data.location || "",
            website: data.website || "",
            photoURL: data.photoURL || user.photoURL || "",
            coverURL: data.coverURL || "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop",
            facebook: data.facebook || "",
            instagram: data.instagram || "",
            youtube: data.youtube || "",
            twitter: data.twitter || "",
            xp: data.xp || 0,
            badges: data.badges || [],
            inventory: data.inventory || []
          });
        } else {
            setProfileData(prev => ({
                ...prev,
                name: user.displayName || "Traveler",
                photoURL: user.photoURL || "",
                coverURL: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop"
            }));
        }

        // 2. Fetch Stories for Stats (Math Fix Applied)
        const q = query(collection(db, "stories"), where("authorId", "==", user.uid));
        const snap = await getDocs(q);
        
        let totalViews = 0, totalLikes = 0, totalShares = 0;
        const uniqueLocations = new Set();

        snap.forEach(doc => {
          const d = doc.data();
          
          // 🛠️ FIX: Views
          totalViews += (d.views || 0);
          
          // 🛠️ FIX: Likes (Number vs Array)
          const l = typeof d.likeCount === 'number' 
              ? d.likeCount 
              : (Array.isArray(d.likes) ? d.likes.length : 0);
          totalLikes += l;

          // 🛠️ FIX: Shares (Number vs Array)
          const s = typeof d.shareCount === 'number' 
              ? d.shareCount 
              : (Array.isArray(d.sharedBy) ? d.sharedBy.length : 0);
          totalShares += s;

          // Location
          if (d.locationData && d.locationData.value && d.locationData.value.place_id) {
             uniqueLocations.add(d.locationData.value.place_id);
          } else if (d.location) {
             uniqueLocations.add(d.location.split(',')[0].trim().toLowerCase());
          }
        });

        setStats({ 
            stories: snap.size, 
            views: totalViews, 
            likes: totalLikes, 
            shares: totalShares, // 🆕 Added
            countries: uniqueLocations.size 
        });

      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Could not load profile data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Save Helper: Auto-prepend HTTPS
  const cleanUrl = (url) => {
      if (!url) return "";
      if (!/^https?:\/\//i.test(url)) return `https://${url}`;
      return url;
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const updatedData = {
          ...profileData,
          website: cleanUrl(profileData.website),
          facebook: cleanUrl(profileData.facebook),
          instagram: cleanUrl(profileData.instagram),
          twitter: cleanUrl(profileData.twitter),
          youtube: cleanUrl(profileData.youtube),
          updatedAt: new Date()
      };
      
      setProfileData(updatedData); // Update local state immediately
      await setDoc(doc(db, "users", user.uid), updatedData, { merge: true });
      setIsEditing(false);
      toast.success("Profile updated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    }
  };

  // Image Upload
  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const toastId = toast.loading("Uploading image...");
    try {
      const storageRef = ref(storage, `users/${user.uid}/${field}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setProfileData(prev => ({ ...prev, [field]: url }));
      await setDoc(doc(db, "users", user.uid), { [field]: url }, { merge: true });
      toast.success("Image updated!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Upload failed: " + error.message, { id: toastId });
    }
  };

  // 🆕 Share Profile Function
  const handleShareProfile = () => {
      const url = `${window.location.origin}/profile/${user.uid}`;
      navigator.clipboard.writeText(url);
      toast.success("Profile link copied to clipboard!");
  };

  if (loading || gameLoading) return <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center">Loading Passport...</div>;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white font-sans pb-20">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' } }} />

      {/* NAVIGATION */}
      <button onClick={() => navigate('/dashboard')} className="fixed top-6 left-6 z-50 bg-black/50 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all hover:scale-105">
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      {/* HERO */}
      <div className="relative h-64 md:h-80 group overflow-hidden">
        <img src={profileData.coverURL} alt="Cover" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-black/20 to-transparent" />
        <label className="absolute top-6 right-6 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg backdrop-blur-md cursor-pointer transition-all opacity-0 group-hover:opacity-100 border border-white/10">
          <Camera size={20} />
          <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'coverURL')} />
        </label>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-24 relative z-10">
        
        {/* PASSPORT HEADER */}
        <div className="flex flex-col md:flex-row gap-8 items-end md:items-start mb-12">
          
          {/* Avatar & Rank */}
          <div className="relative group shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1.5 bg-gradient-to-tr from-orange-500 to-purple-600 shadow-2xl relative z-10">
              <img src={profileData.photoURL || `https://ui-avatars.com/api/?name=${profileData.name}`} alt="Profile" className="w-full h-full rounded-full object-cover bg-slate-800 border-4 border-[#0B0F19]" />
            </div>
            
            {/* ⚡ DYNAMIC RANK BADGE */}
            <div className="absolute bottom-2 -right-2 z-20">
                <LevelBadge rank={currentRank} size="lg" />
            </div>

            <label className="absolute bottom-2 left-2 bg-orange-600 text-white p-2 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform z-20 border border-black">
              <Camera size={16} />
              <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'photoURL')} />
            </label>
          </div>

          {/* Info & Inputs */}
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                {isEditing ? (
                  <input 
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-2xl font-bold text-white w-full focus:outline-none focus:border-orange-500"
                    placeholder="Display Name"
                  />
                ) : (
                  <h1 className="text-4xl font-bold text-white tracking-tight">{profileData.name}</h1>
                )}
                
                <div className="flex flex-wrap items-center gap-4 text-slate-400 mt-3 text-sm">
                  <div className="flex items-center gap-1">
                    <MapPin size={14} /> 
                    {isEditing ? (
                        <input value={profileData.location} onChange={(e) => setProfileData({...profileData, location: e.target.value})} className="bg-transparent border-b border-white/20 text-white w-32 focus:outline-none focus:border-orange-500" placeholder="Location" />
                    ) : (<span>{profileData.location || "World Citizen"}</span>)}
                  </div>
                  <div className="flex items-center gap-1">
                    <LinkIcon size={14} /> 
                    {isEditing ? (
                        <input value={profileData.website} onChange={(e) => setProfileData({...profileData, website: e.target.value})} className="bg-transparent border-b border-white/20 text-white w-40 focus:outline-none focus:border-orange-500" placeholder="Website URL" />
                    ) : (<a href={profileData.website} target="_blank" rel="noreferrer" className="hover:text-orange-400 truncate max-w-[150px]">{profileData.website || "No website"}</a>)}
                  </div>
                </div>

                {/* ⚡ DYNAMIC LEVEL PROGRESS */}
                <div className="max-w-md mt-2">
                    <LevelProgress currentXP={profileData.xp} rankData={currentRank} />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 self-start md:self-center">
                {isEditing ? (
                  <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/20"><Save size={18}/> Save</button>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(true)} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all backdrop-blur-md"><Edit2 size={18}/> Edit</button>
                    {/* 🆕 SHARE PROFILE BUTTON */}
                    <button onClick={handleShareProfile} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all backdrop-blur-md" title="Share Profile"><Share2 size={18}/></button>
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {isEditing ? (
              <textarea value={profileData.bio} onChange={(e) => setProfileData({...profileData, bio: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-slate-300 mt-2 focus:border-orange-500/50 outline-none resize-none" rows={3} placeholder="Tell the world about your travels..." />
            ) : (
              <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">{profileData.bio}</p>
            )}

            {/* SOCIAL LINKS */}
            {isEditing ? (
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 mt-4 animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Social Links</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SocialInput icon={<Facebook size={16}/>} value={profileData.facebook} onChange={e => setProfileData({...profileData, facebook: e.target.value})} placeholder="Facebook URL" />
                        <SocialInput icon={<Instagram size={16}/>} value={profileData.instagram} onChange={e => setProfileData({...profileData, instagram: e.target.value})} placeholder="Instagram URL" />
                        <SocialInput icon={<Youtube size={16}/>} value={profileData.youtube} onChange={e => setProfileData({...profileData, youtube: e.target.value})} placeholder="YouTube URL" />
                        <SocialInput icon={<Twitter size={16}/>} value={profileData.twitter} onChange={e => setProfileData({...profileData, twitter: e.target.value})} placeholder="X (Twitter) URL" />
                    </div>
                </div>
            ) : (
                <div className="flex gap-3 pt-2">
                    {profileData.facebook && <SocialIcon icon={<Facebook size={20}/>} link={profileData.facebook} color="hover:text-blue-500" />}
                    {profileData.instagram && <SocialIcon icon={<Instagram size={20}/>} link={profileData.instagram} color="hover:text-pink-500" />}
                    {profileData.youtube && <SocialIcon icon={<Youtube size={20}/>} link={profileData.youtube} color="hover:text-red-500" />}
                    {profileData.twitter && <SocialIcon icon={<Twitter size={20}/>} link={profileData.twitter} color="hover:text-sky-400" />}
                </div>
            )}
          </div>
        </div>

        {/* ⚡ FIXED STATS GRID (5 Columns) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
          <StatBox label="Stories Written" value={stats.stories} icon={<BookOpen className="text-blue-400" />} />
          <StatBox label="Places Visited" value={stats.countries} icon={<Globe className="text-emerald-400" />} />
          <StatBox label="Total Likes" value={stats.likes} icon={<Heart className="text-red-400" />} />
          <StatBox label="Total Views" value={stats.views} icon={<Eye className="text-purple-400" />} />
          {/* 🆕 SHARES STAT */}
          <StatBox label="Total Shares" value={stats.shares} icon={<Share2 className="text-orange-400" />} />
        </div>

        {/* ⚡ DYNAMIC ACHIEVEMENTS & TREASURES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Award className="text-yellow-500" /> Achievements</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {badges.map(badge => (
                        <div key={badge.id} className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all hover:scale-105 select-none ${badge.isUnlocked ? 'bg-gradient-to-br from-orange-500/10 to-purple-500/10 border-orange-500/30 shadow-lg shadow-orange-500/5' : 'bg-white/5 border-white/5 opacity-40 grayscale'}`}>
                            <div className="text-orange-400 mb-2 p-2 bg-white/5 rounded-lg"><RenderIcon iconName={badge.icon} size={24}/></div>
                            <div className="font-bold text-sm text-white mb-1">{badge.name}</div>
                            <div className="text-[10px] text-slate-400">{badge.description}</div>
                        </div>
                    ))}
                    {badges.length === 0 && <p className="text-slate-500 text-sm italic">No badges configured.</p>}
                </div>
            </div>
            
            <div className="space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Gem className="text-purple-500" /> Artifact Collection</h2>
                <div className="bg-[#111625]/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-50" />
                    <div className="grid grid-cols-3 gap-3 relative z-10">
                        {loot.map(item => (
                            <div key={item.id} title={item.isUnlocked ? item.name : "Locked"} className={`aspect-square rounded-lg border flex flex-col items-center justify-center transition-colors ${item.isUnlocked ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-black/40 border-white/5 text-white/10'}`}>
                                <RenderIcon iconName={item.icon} size={20} />
                                {item.isUnlocked && <span className="text-[8px] mt-1 font-bold truncate max-w-full px-1">{item.name}</span>}
                            </div>
                        ))}
                        {loot.length === 0 && <p className="text-slate-500 text-xs col-span-3 text-center">No artifacts discovered yet.</p>}
                    </div>
                    {loot.every(l => !l.isUnlocked) && (
                        <div className="mt-4 text-center"><p className="text-sm font-medium text-white">Collection Locked</p><p className="text-xs text-slate-500">Discover hidden items in stories to unlock.</p></div>
                    )}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

/* SUB COMPONENTS */
function StatBox({ label, value, icon }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111625]/60 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors group backdrop-blur-sm">
      <div className="p-3 bg-white/5 rounded-full mb-3 group-hover:scale-110 transition-transform shadow-lg">{icon}</div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">{label}</div>
    </motion.div>
  );
}

function SocialInput({ icon, value, onChange, placeholder }) {
    return (
        <div className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-lg px-3 py-2 focus-within:border-orange-500/50 transition-colors">
            <div className="text-slate-400">{icon}</div>
            <input className="bg-transparent border-none text-sm text-white focus:outline-none w-full placeholder:text-slate-600" placeholder={placeholder} value={value} onChange={onChange} />
        </div>
    )
}

function SocialIcon({ icon, link, color }) {
    return (
        <a href={link} target="_blank" rel="noreferrer" className={`p-3 bg-white/5 rounded-full text-slate-400 transition-colors ${color}`}>{icon}</a>
    )
}