import React, { useState } from 'react';
import { db } from './services/firebase'; 
import { doc, setDoc } from 'firebase/firestore';

const UploadData = () => {
  const [status, setStatus] = useState("Idle - Ready to Upload Difficulty Levels");

  const difficulties = [
    { 
      id: 'easy', 
      label: 'Easy & Relaxed', 
      description: 'No physical effort. Suitable for all ages.',
      icon: 'LuSmile', 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      id: 'moderate', 
      label: 'Moderate Activity', 
      description: 'Some walking or hiking. Good for active people.',
      icon: 'LuFootprints', 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      id: 'challenging', 
      label: 'Challenging', 
      description: 'Steep climbs or long treks. Requires fitness.',
      icon: 'LuTrendingUp', 
      color: 'text-orange-600', 
      bg: 'bg-orange-50' 
    },
    { 
      id: 'extreme', 
      label: 'Extreme / Tough', 
      description: 'High altitude or technical terrain. Experts only.',
      icon: 'LuFlame', 
      color: 'text-red-600', 
      bg: 'bg-red-50' 
    }
  ];

  const handleUpload = async () => {
    setStatus("Uploading...");
    try {
      for (const item of difficulties) {
        // Path: meta -> difficulty -> difficulty -> [id]
        // This creates a NEW collection called "difficulty" next to "tripTypes"
        const docRef = doc(db, "meta", "difficultyLevels", "difficultyLevels", item.id);
        await setDoc(docRef, item);
        console.log(`Uploaded: ${item.label}`);
      }
      setStatus("✅ Success! Difficulty levels uploaded.");
    } catch (error) {
      console.error("Error uploading:", error);
      setStatus("❌ Error: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Upload Difficulty Levels</h2>
        <button 
          onClick={handleUpload}
          className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700"
        >
          UPLOAD NOW
        </button>
        <p className="mt-4 font-mono text-sm text-gray-700">{status}</p>
      </div>
    </div>
  );
};

export default UploadData;