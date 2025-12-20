// src/pages/Onboarding.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import OnboardingStep from "../components/premium/OnboardingStep";
import { useAuth } from "../contexts/AuthContext";
import { markOnboarded } from "../services/profileService";

const steps = [
  {
    title: "Welcome",
    text: "Welcome to JourneysPage — let's make your profile shine.",
    key: "welcome",
  },
  {
    title: "Your Profile",
    text: "Add a profile photo and a short bio so travellers can recognise you.",
    key: "profile",
  },
  {
    title: "Preferences",
    text: "Choose what you love and how JourneysPage should look for you.",
    key: "prefs",
  },
  {
    title: "All Set!",
    text: "You're ready! Start sharing stories and earn your first level.",
    key: "finish",
  },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  const [formData, setFormData] = useState({
    bio: "",
    interests: [],
    darkMode: false,
  });

  const isLast = index === steps.length - 1;

  async function next() {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }

    // ✅ SAVE ONBOARDING FLAG
    if (user?.uid) {
      await markOnboarded(user.uid, {
        bio: formData.bio,
        interests: formData.interests,
        darkMode: formData.darkMode,
      });
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="w-full max-w-2xl p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.4 }}
          >
            <OnboardingStep
              step={steps[index]}
              index={index}
              total={steps.length}
              onNext={next}
              formData={formData}
              setFormData={setFormData}
            />
          </motion.div>
        </AnimatePresence>

        {/* Progress */}
        <div className="mt-6 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
