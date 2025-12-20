import React from "react";
import { motion } from "framer-motion";
import { Camera, Sun, Moon } from "lucide-react";

export default function OnboardingStep({
  step,
  onNext,
  index,
  total,
  formData,
  setFormData,
}) {
  const isLast = index === total - 1;

  // handle input updates
  const update = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // interest tags
  const toggleInterest = (tag) => {
    setFormData((prev) => {
      const set = new Set(prev.interests || []);
      set.has(tag) ? set.delete(tag) : set.add(tag);
      return { ...prev, interests: Array.from(set) };
    });
  };

  // dark mode toggle
  const toggleDark = () => update("darkMode", !formData.darkMode);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="
        bg-white/10
        backdrop-blur-xl
        rounded-2xl
        p-8
        border border-white/20
        shadow-2xl
        text-white
      "
    >
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold drop-shadow">{step.title}</h3>
        <div className="text-sm text-gray-300">
          {index + 1}/{total}
        </div>
      </div>

      <p className="text-gray-300 mb-6">{step.text}</p>

      {/* ----------------------------- */}
      {/* 👤 STEP: PROFILE DETAILS      */}
      {/* ----------------------------- */}
      {step.key === "profile" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5 mb-6"
        >
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <label className="cursor-pointer relative group">
              <div className="
                w-20 h-20 rounded-full overflow-hidden 
                bg-white/10 border border-white/20 
                flex items-center justify-center 
                group-hover:bg-white/20 transition
              ">
                {formData.avatar ? (
                  <img
                    src={formData.avatarPreview}
                    alt="avatar"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <Camera className="w-6 h-6 text-gray-300" />
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  update("avatar", file);
                  update("avatarPreview", URL.createObjectURL(file));
                }}
              />
            </label>

            <div>
              <p className="text-sm text-gray-300">
                Upload a profile photo
              </p>
              <p className="text-xs text-gray-500">
                JPG or PNG · Max 2MB
              </p>
            </div>
          </div>

          {/* Bio */}
          <textarea
            className="
              w-full p-3 rounded-lg bg-white/10 
              border border-white/20 text-white resize-none 
              placeholder-gray-400
            "
            rows={3}
            placeholder="Write something about yourself..."
            value={formData.bio || ""}
            onChange={(e) => update("bio", e.target.value)}
          />
        </motion.div>
      )}

      {/* ----------------------------- */}
      {/* 🌄 STEP: INTEREST SELECTION   */}
      {/* ----------------------------- */}
      {step.key === "interests" && (
        <div className="space-y-4 mb-6">
          <p className="text-gray-300 text-sm">
            Pick what you love (you can change later)
          </p>

          <div className="flex flex-wrap gap-2">
            {[
              "Mountains",
              "Hiking",
              "Food",
              "Culture",
              "Photography",
              "Road Trips",
              "Camping",
              "Cities",
            ].map((tag) => {
              const selected = formData.interests?.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleInterest(tag)}
                  className={`
                    px-4 py-1.5 rounded-full text-sm transition 
                    border 
                    ${
                      selected
                        ? "bg-orange-500 border-orange-400 text-white"
                        : "bg-white/5 border-white/20 text-gray-300"
                    }
                  `}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------- */}
      {/* 🌗 STEP: DARK MODE            */}
      {/* ----------------------------- */}
      {step.key === "prefs" && (
        <div className="space-y-5 mb-6">
          <p className="text-sm text-gray-300">
            Choose your appearance preference
          </p>

          <button
            onClick={toggleDark}
            className="
              flex items-center justify-between 
              w-full p-4 rounded-xl 
              bg-white/10 border border-white/20
            "
          >
            <span>Dark Mode</span>
            {formData.darkMode ? (
              <Moon className="text-yellow-400" />
            ) : (
              <Sun className="text-orange-400" />
            )}
          </button>
        </div>
      )}

      {/* ----------------------------- */}
      {/* 🎉 FINAL STEP                 */}
      {/* ----------------------------- */}
      {step.key === "finish" && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-6"
        >
          <h2 className="text-3xl font-bold text-white mb-2 drop-shadow">
            You're ready!
          </h2>
          <p className="text-gray-300">
            Your profile is set. Let’s explore amazing stories.
          </p>
        </motion.div>
      )}

      {/* FOOTER BUTTON */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="
            px-5 py-2 rounded-xl 
            bg-gradient-to-r from-orange-500 to-red-500 
            font-semibold shadow
            hover:scale-[1.05] transition-transform
          "
        >
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
    </motion.div>
  );
}
