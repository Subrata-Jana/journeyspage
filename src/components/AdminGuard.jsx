import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();

  // 🔒 OPTIMUM SECURITY CONFIGURATION
  // Replace these with the exact email(s) you use to login
  const AUTHORIZED_ADMINS = [
    "sjsubratajana@gmail.com", 
    //another-admin@example.com"
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

  // 🚫 LOGIC: If user is logged in BUT email is not in the list -> Kick to Home
  if (user && !AUTHORIZED_ADMINS.includes(user.email)) {
    return <Navigate to="/" replace />;
  }

  // If not logged in at all, ProtectedRoute will catch them first, 
  // but just in case, we can redirect or let ProtectedRoute handle it.
  if (!user) {
      return <Navigate to="/login" replace />;
  }

  // ✅ ACCESS GRANTED
  return children;
}