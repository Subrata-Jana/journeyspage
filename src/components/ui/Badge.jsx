export default function Badge({ label }) {
  return (
    <span className="rounded-full bg-blue-600 text-white text-xs px-3 py-1">
      {label}
    </span>
  );
}
