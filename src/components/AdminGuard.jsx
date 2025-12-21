import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();

  // 🔒 STRICT SECURITY: Only this specific email is allowed
  const AUTHORIZED_ADMINS = [
    "sjsubratajana@gmail.com"
  ];

  if (loading) {
    return (
      <div className="h-screen bg-[#0B0F19] flex items-center justify-center text-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
            <ShieldAlert size={48} className="text-orange-500" />
            <span className="text-lg font-mono">Verifying Clearance...</span>
        </div>
      </div>
    );
  }

  // Debug: See who is trying to enter
  if (user) console.log("User attempting admin access:", user.email);

  // If user is logged in BUT not the admin -> Kick to Home
  if (user && !AUTHORIZED_ADMINS.includes(user.email)) {
    return <Navigate to="/" replace />;
  }

  // If not logged in -> Kick to Login
  if (!user) {
      return <Navigate to="/login" replace />;
  }

  return children;
}