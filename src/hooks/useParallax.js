// useParallax.js
import { useEffect } from "react";
import { gsap } from "gsap";

export default function useParallax(containerRef, options = {}) {
  useEffect(() => {
    if (!containerRef?.current) return;
    const ctx = gsap.context(() => {
      const layers = containerRef.current.querySelectorAll("[data-depth]");
      function onMove(e) {
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const x = (e.clientX - cx) / rect.width;
        const y = (e.clientY - cy) / rect.height;
        layers.forEach((el) => {
          const depth = parseFloat(el.dataset.depth) || 0.03;
          gsap.to(el, { x: -x * depth * 100, y: -y * depth * 100, rotationY: x * depth * 6, rotationX: -y * depth * 6, ease: "power3.out", duration: 0.6 });
        });
      }
      containerRef.current.addEventListener("pointermove", onMove);
      return () => {
        containerRef.current.removeEventListener("pointermove", onMove);
      };
    }, containerRef);
    return () => ctx.revert();
  }, [containerRef]);
}
