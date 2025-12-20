// ParallaxHero.jsx
import React, { useRef } from "react";
import useParallax from "../../hooks/useParallax";

export default function ParallaxHero() {
  const ref = useRef(null);
  useParallax(ref);

  return (
    <section ref={ref} className="relative h-[420px] rounded-2xl overflow-hidden">
      {/* Furthest background */}
      <div data-depth="0.02" className="absolute inset-0 bg-[url('/assets/mountains-bg.jpg')] bg-cover bg-center transform" />
      {/* middle layer (clouds) */}
      <div data-depth="0.05" className="absolute inset-0 bg-[url('/assets/clouds.png')] opacity-30 mix-blend-screen" />
      {/* Foreground layer */}
      <div data-depth="0.12" className="absolute inset-0 flex items-end justify-center pointer-events-none">
        <div className="w-3/4 transform translate-y-8">
          <div className="rounded-xl p-6 bg-gradient-to-br from-white/6 to-black/20 border border-white/10 backdrop-blur-lg shadow-2xl text-white">
            <h2 className="text-3xl font-bold">Discover hidden trails</h2>
            <p className="text-gray-300 mt-2">Turn your stories into a living travelbook — animated, sharable, unforgettable.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
