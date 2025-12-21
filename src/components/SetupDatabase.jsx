import React, { useState } from "react";
import { db } from "../services/firebase"; // Check your path!
import { doc, setDoc } from "firebase/firestore";

const SetupDatabase = () => {
  const [status, setStatus] = useState("Ready to Upload");

  // 1. DATA: The 15 Heirlooms (Loot Box)
  const heirloomData = [
    // PLANE
    { id: 'silver_compass', name: 'Silver Compass', category: 'plane', rarity: 'Common', chance: 60, icon: 'Compass' },
    { id: 'vintage_stamp', name: 'Vintage Airmail Stamp', category: 'plane', rarity: 'Uncommon', chance: 90, icon: 'Ticket' },
    { id: 'platinum_wings', name: 'Platinum Aviator Wings', category: 'plane', rarity: 'LEGENDARY', chance: 100, icon: 'Feather' },
    // BOAT
    { id: 'sea_glass', name: 'Polished Sea Glass', category: 'boat', rarity: 'Common', chance: 60, icon: 'Gem' },
    { id: 'brass_sextant', name: 'Brass Sextant', category: 'boat', rarity: 'Uncommon', chance: 90, icon: 'Anchor' },
    { id: 'sapphire_ring', name: 'Blue Sapphire Ring', category: 'boat', rarity: 'LEGENDARY', chance: 100, icon: 'Circle' },
    // BOTTLE
    { id: 'sahara_sand', name: 'Vial of Sahara Sand', category: 'bottle', rarity: 'Common', chance: 60, icon: 'Droplet' },
    { id: 'antique_parchment', name: 'Antique Parchment', category: 'bottle', rarity: 'Uncommon', chance: 90, icon: 'FileText' },
    { id: 'shipwreck_coin', name: 'Shipwreck Silver Coin', category: 'bottle', rarity: 'LEGENDARY', chance: 100, icon: 'Coins' },
    // LANTERN
    { id: 'beeswax_candle', name: 'Beeswax Candle', category: 'lantern', rarity: 'Common', chance: 60, icon: 'Flame' },
    { id: 'clear_quartz', name: 'Clear Quartz Crystal', category: 'lantern', rarity: 'Uncommon', chance: 90, icon: 'Hexagon' },
    { id: 'fire_opal', name: 'Rare Fire Opal', category: 'lantern', rarity: 'LEGENDARY', chance: 100, icon: 'Sun' },
    // BOX
    { id: 'flint_arrowhead', name: 'Flint Arrowhead', category: 'box', rarity: 'Common', chance: 60, icon: 'Triangle' },
    { id: 'ammonite_fossil', name: 'Ammonite Fossil', category: 'box', rarity: 'Uncommon', chance: 90, icon: 'Circle' },
    { id: 'gold_nugget', name: 'Raw Gold Nugget', category: 'box', rarity: 'LEGENDARY', chance: 100, icon: 'CreditCard' }
  ];

  // 2. DATA: The 5 Hidden Treasures (Map/Footer Secrets)
  const treasureData = [
    { id: 'golden_compass', name: 'Golden Compass', points: 1000, color: 'yellow', icon: 'Compass' },
    { id: 'atlantis_map', name: 'Atlantis Map', points: 500, color: 'cyan', icon: 'Map' },
    { id: 'forbidden_relic', name: 'Forbidden Relic', points: 2500, color: 'red', icon: 'Skull' },
    { id: 'pirates_gold', name: 'Pirate\'s Gold', points: 750, color: 'amber', icon: 'Coins' },
    { id: 'time_capsule', name: 'Time Capsule', points: 300, color: 'blue', icon: 'Watch' }
  ];

  const handleUpload = async () => {
    setStatus("Uploading...");
    try {
      // Upload Heirlooms to 'meta/loot'
      await setDoc(doc(db, "meta", "loot"), { items: heirloomData });
      
      // Upload Treasures to 'meta/treasures'
      await setDoc(doc(db, "meta", "treasures"), { items: treasureData });

      setStatus("✅ Success! Database Populated.");
    } catch (error) {
      console.error(error);
      setStatus("❌ Error: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white">
      <div className="bg-slate-800 p-10 rounded-2xl text-center border border-slate-600">
        <h2 className="text-3xl font-bold mb-4 text-orange-500">Database Setup</h2>
        <p className="mb-6 text-slate-300">Click below to fix your empty database.</p>
        
        <button 
          onClick={handleUpload}
          className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl text-xl transition shadow-lg shadow-green-900/50"
        >
          UPLOAD ALL DATA
        </button>

        <p className="mt-6 font-mono text-sm">{status}</p>
        
        <p className="mt-8 text-xs text-slate-500">
            (Remove this component from code after seeing "Success")
        </p>
      </div>
    </div>
  );
};

export default SetupDatabase;