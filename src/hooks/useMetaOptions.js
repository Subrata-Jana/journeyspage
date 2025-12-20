// src/hooks/useMetaOptions.js
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";

export function useMetaOptions(category) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const ref = collection(db, "meta", category, category);
        const snap = await getDocs(ref);

        const data = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            value: d.id || doc.id,
            label: d.label || doc.id,
            icon: d.icon || null,
            color: d.color || "",
            bg: d.bg || "",
            description: d.description || "",
          };
        });

        setOptions(data);
      } catch (err) {
        console.error(`Failed to load meta options: ${category}`, err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchOptions();
  }, [category]);

  return { options, loading };
}
