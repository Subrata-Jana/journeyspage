import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export function useMetaOptions(collectionName) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchOptions = async () => {
      try {
        const docRef = doc(db, "meta", collectionName);
        const snapshot = await getDoc(docRef);
        
        if (mounted && snapshot.exists()) {
          setOptions(snapshot.data().items || []);
        }
      } catch (error) {
        // 🤫 Silently fail permissions errors during dev to avoid red console spam
        if (error.code !== 'permission-denied') {
            console.error(`Error loading ${collectionName}:`, error);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOptions();

    return () => { mounted = false; };
  }, [collectionName]);

  return { options, loading };
}