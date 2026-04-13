import React, { useEffect, useRef, useState } from "react";

function ImagePlaceholder({ variant = "default" }) {
  const variantClasses =
    variant === "hero"
      ? "from-slate-950 via-slate-900 to-[#10192b]"
      : "from-slate-900 via-slate-800 to-slate-900";

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${variantClasses}`} />
      <div className="absolute inset-0 animate-pulse opacity-80">
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
    </div>
  );
}

export default function SmartImage({
  src,
  alt,
  className = "",
  imgClassName = "",
  placeholderClassName = "",
  variant = "default",
  showLoader = true,
  fallback = null,
  onClick,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
}) {
  const imgRef = useRef(null);
  const [status, setStatus] = useState(src ? "loading" : "error");

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }

    let isActive = true;
    setStatus("loading");

    const probe = new Image();
    probe.decoding = decoding;
    if (fetchPriority) probe.fetchPriority = fetchPriority;

    const markReady = () => {
      if (isActive) setStatus("ready");
    };

    const markError = () => {
      if (isActive) setStatus("error");
    };

    probe.onload = markReady;
    probe.onerror = markError;
    probe.src = src;

    if (probe.complete && probe.naturalWidth > 0) {
      markReady();
    }

    return () => {
      isActive = false;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [src, decoding, fetchPriority]);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setStatus("ready");
    }
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`} onClick={onClick}>
      {showLoader && status === "loading" && (
        <div className={`absolute inset-0 ${placeholderClassName}`}>
          <ImagePlaceholder variant={variant} />
        </div>
      )}

      {src ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className={`${imgClassName} transition-[opacity,transform,filter] duration-700 ease-out ${
            status === "ready"
              ? "opacity-100 scale-100 blur-0"
              : "opacity-0 scale-[1.03] blur-sm"
          }`}
        />
      ) : null}

      {status === "error" && fallback ? (
        <div className="absolute inset-0">{fallback}</div>
      ) : null}
    </div>
  );
}
