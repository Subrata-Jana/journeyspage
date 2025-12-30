import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, Maximize, Minimize, X } from "lucide-react";

export default function ThreeSixtyViewer({ imageUrl, onClose }) {
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  
  const [status, setStatus] = useState("loading"); 
  const [errorMsg, setErrorMsg] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const viewerInstance = useRef(null);

  // ⚡ TOGGLE FULL SCREEN
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // ⚡ HANDLE CLOSE
  const handleClose = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    if (onClose) onClose();
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // -------------------------------------------
  // ⚡ INIT VIEWER LOGIC
  // -------------------------------------------
  useEffect(() => {
    if (!imageUrl) return;
    let intervalId = null;
    let timeoutId = null;

    const initViewer = () => {
      if (!viewerRef.current || !window.pannellum) return;
      
      // Cleanup old instance
      if (viewerInstance.current) {
         try { viewerInstance.current.destroy(); } catch(e) {}
      }

      const img = new Image();
      img.src = imageUrl;

      img.onload = () => {
        if (!viewerRef.current) return;

        // 1. CALCULATE IMAGE GEOMETRY (The "Black Hole" Fix)
        const imgWidth = img.width;
        const imgHeight = img.height;
        // How much vertical world does this image cover?
        const verticalCoverage = (imgHeight / imgWidth) * 360; 
        const safeVaov = Math.min(179, Math.max(10, verticalCoverage)); 

        // 2. DETECT MOBILE / PORTRAIT MODE (The "Mobile View" Fix)
        const containerWidth = viewerRef.current.clientWidth;
        const containerHeight = viewerRef.current.clientHeight;
        const isPortrait = containerHeight > containerWidth;

        // ⚡ MOBILE OPTIMIZATION:
        // - Portrait (Mobile): Zoom IN (60 degrees) to fill height
        // - Landscape (Desktop): Zoom OUT (110 degrees) to see width
        const initialFov = isPortrait ? 60 : 110; 
        // Restrict max zoom out on mobile so they don't see the black bars again
        const maxFov = isPortrait ? 90 : 120; 

        try {
          viewerRef.current.innerHTML = ""; 
          viewerInstance.current = window.pannellum.viewer(viewerRef.current, {
            type: "equirectangular",
            panorama: imageUrl,
            
            // Geometry
            haov: 360,
            vaov: safeVaov,
            vOffset: 0,
            
            // ⚡ DYNAMIC CAMERA SETTINGS
            hfov: initialFov,         // Start Zoom level based on screen shape
            minHfov: 40,              // Max Zoom In
            maxHfov: maxFov,          // Max Zoom Out (Restricted on mobile)
            
            // Auto Rotation
            autoLoad: true,
            autoRotate: -2,
            autoRotateInactivityDelay: 3000,
            
            // UI
            showZoomCtrl: false,
            showFullscreenCtrl: false,
            compass: false,
            mouseZoom: false,
            keyboardZoom: false,
            yaw: 0,
            pitch: 0,
            backgroundColor: [0, 0, 0], // Ensure background is black
          });
          setStatus("ready");
        } catch (err) {
          console.error("Viewer Init Error:", err);
          setErrorMsg("Viewer Error");
          setStatus("error");
        }
      };

      img.onerror = () => {
         setErrorMsg("Failed to load image file");
         setStatus("error");
      };
    };

    // Library Loader
    const loadLibrary = () => {
      if (window.pannellum) {
        initViewer();
        return;
      }
      if (!document.getElementById("pannellum-css")) {
        const link = document.createElement("link");
        link.id = "pannellum-css";
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css";
        document.head.appendChild(link);
      }
      if (!document.getElementById("pannellum-js")) {
        const script = document.createElement("script");
        script.id = "pannellum-js";
        script.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js";
        document.head.appendChild(script);
      }
      intervalId = setInterval(() => {
        if (window.pannellum) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          initViewer();
        }
      }, 100);
      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        if (!window.pannellum) {
          setErrorMsg("Network Error: Could not load 360 Library");
          setStatus("error");
        }
      }, 10000);
    };

    loadLibrary();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (viewerInstance.current) {
         try { viewerInstance.current.destroy(); } catch (e) {}
      }
    };
  }, [imageUrl]);

  if (status === "error") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-red-400 gap-2 p-4 text-center border border-white/10 rounded-2xl relative">
        <AlertCircle size={32} />
        <p className="text-sm font-bold">{errorMsg || "Error loading viewer"}</p>
        <button onClick={onClose} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full text-white hover:bg-white/20">
            <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
      
      {/* Viewer Container */}
      <div ref={viewerRef} className="w-full h-full" style={{ outline: 'none' }} />

      {/* ⚡ CUSTOM CONTROLS OVERLAY */}
      <div className="absolute top-4 right-4 z-[9999] flex items-center gap-3">
        {status === "ready" && (
            <button 
                onClick={toggleFullscreen}
                className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 border border-white/10 hover:bg-white/10 hover:scale-105 transition-all shadow-lg"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
                {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
            </button>
        )}
        <button 
            onClick={handleClose}
            className="p-2.5 rounded-full bg-red-500/80 backdrop-blur-md text-white border border-white/10 hover:bg-red-600 hover:scale-105 transition-all shadow-lg"
            title="Close"
        >
            <X size={20}/>
        </button>
      </div>

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <Loader2 className="animate-spin text-white/50" size={32} />
        </div>
      )}

      {/* Hint */}
      {status === "ready" && !isFullscreen && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white/90 px-6 py-2.5 rounded-full text-xs font-bold tracking-wider pointer-events-none select-none border border-white/10 shadow-xl z-10 flex items-center gap-2 uppercase animate-in fade-in slide-in-from-bottom-4">
          <span>🔄 Drag to Explore</span>
        </div>
      )}
    </div>
  );
}