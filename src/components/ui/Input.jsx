export default function Input({ icon: Icon, type = "text", ...props }) {
  return (
    <div className="relative group">
      {Icon && (
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-400 transition-colors w-5 h-5" />
      )}
      <input
        type={type}
        className="
          w-full 
          bg-white/5 
          border border-white/10 
          rounded-xl 
          px-11 py-3.5 
          text-white 
          placeholder-gray-500 
          outline-none 
          transition-all 
          duration-300
          focus:bg-white/10 
          focus:border-orange-500/50 
          focus:ring-2 
          focus:ring-orange-500/20
        "
        {...props}
      />
    </div>
  );
}