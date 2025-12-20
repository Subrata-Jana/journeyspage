import { motion } from "framer-motion";

export default function AuthCard({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="
        w-full 
        bg-black/40 
        backdrop-blur-xl 
        p-8 
        rounded-2xl 
        border border-white/10 
        shadow-2xl 
        shadow-black/50
      "
    >
      <h2 className="text-2xl font-bold text-white mb-6 text-center tracking-wide">
        {title}
      </h2>
      {children}
    </motion.div>
  );
}