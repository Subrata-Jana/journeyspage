import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Globe2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThreeSixtyViewer from "./ThreeSixtyViewer";
import SmartImage from "./ui/SmartImage";

export default function GallerySlider({ images, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);

    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [currentIndex]);

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const currentImage = images[currentIndex];

  return (
    <div className="fixed inset-0 z-100 bg-black/95 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 shadow-lg border border-white/10 group"
        title="Close (Esc)"
      >
        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      <button
        onClick={handlePrev}
        className="absolute left-4 md:left-8 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all z-40 hidden md:flex group items-center justify-center backdrop-blur-sm"
      >
        <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-4 md:right-8 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all z-40 hidden md:flex group items-center justify-center backdrop-blur-sm"
      >
        <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
      </button>

      <div className="w-full h-full md:w-[85vw] md:h-[85vh] relative flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center relative"
          >
            {currentImage.is360 ? (
              <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative bg-black">
                <ThreeSixtyViewer imageUrl={currentImage.url} onClose={onClose} />

                <div className="absolute top-4 left-4 bg-blue-600/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 z-10 pointer-events-none shadow-lg backdrop-blur-md border border-white/10">
                  <Globe2 size={14} className="animate-spin-slow" /> 360° Panorama
                </div>
              </div>
            ) : (
              <SmartImage
                src={currentImage.url}
                alt={currentImage.caption || "Gallery"}
                className="w-full h-full"
                imgClassName="w-full h-full max-h-screen max-w-screen object-contain mx-auto"
                variant="hero"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 to-transparent pointer-events-none flex flex-col items-center justify-end pb-8">
        <div className="max-w-3xl mx-auto text-center space-y-2">
          <p className="text-white/90 font-medium text-lg text-shadow-sm leading-relaxed">
            {currentImage.caption || "Untitled Moment"}
          </p>
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-mono tracking-widest">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    </div>
  );
}
