export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white dark:bg-black p-6 rounded-xl">
        {children}
        <button onClick={onClose} className="mt-4">Close</button>
      </div>
    </div>
  );
}
