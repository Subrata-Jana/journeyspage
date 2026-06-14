import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("react") || id.includes("react-router-dom")) {
            return "react-vendor";
          }

          if (id.includes("@firebase/firestore") || id.includes("firebase/firestore")) {
            return "firebase-firestore-vendor";
          }

          if (id.includes("@firebase/auth") || id.includes("firebase/auth")) {
            return "firebase-auth-vendor";
          }

          if (id.includes("@firebase/storage") || id.includes("firebase/storage")) {
            return "firebase-storage-vendor";
          }

          if (id.includes("firebase") || id.includes("@firebase")) {
            return "firebase-core-vendor";
          }

          if (id.includes("framer-motion")) {
            return "animation-vendor";
          }

          if (
            id.includes("react-hot-toast") ||
            id.includes("react-select") ||
            id.includes("browser-image-compression") ||
            id.includes("pannellum") ||
            id.includes("gsap") ||
            id.includes("lodash") ||
            id.includes("date-fns") ||
            id.includes("canvas-confetti")
          ) {
            return "feature-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
