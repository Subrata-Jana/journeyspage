export function goBackOrFallback(navigate, fallback = "/", from = null) {
  if (typeof from === "string" && from.trim()) {
    navigate(from);
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    navigate(-1);
    return;
  }

  navigate(fallback, { replace: true });
}
