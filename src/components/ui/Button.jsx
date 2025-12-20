export default function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`
        w-full 
        py-3.5 
        rounded-xl 
        font-bold 
        text-white 
        shadow-lg 
        shadow-orange-900/20
        bg-gradient-to-r from-orange-600 to-red-600 
        hover:from-orange-500 hover:to-red-500 
        transform transition-all duration-200 
        hover:scale-[1.02] 
        active:scale-95
        ${className}
      `}
    >
      {children}
    </button>
  );
}