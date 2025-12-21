import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore"; // ⚡ Changed imports
import { db } from "../services/firebase";

export function useMetaOptions(docId) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;

    // ⚡ NEW LOGIC: Listen to the single document, not a collection
    // This matches: meta -> tripTypes (Document) -> items (Array)
    const unsub = onSnapshot(doc(db, "meta", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // We grab the "items" list directly
        setOptions(data.items || []);
        
        // Debugging: Check console to see data loading
        console.log(`✅ Loaded ${docId}:`, data.items);
      } else {
        console.warn(`⚠️ Document 'meta/${docId}' not found.`);
        setOptions([]);
      }
      setLoading(false);
    }, (err) => {
      console.error(`❌ Failed to load ${docId}:`, err);
      setOptions([]);
      setLoading(false);
    });

    // Cleanup listener when component unmounts
    return () => unsub();
  }, [docId]);

  return { options, loading };
}