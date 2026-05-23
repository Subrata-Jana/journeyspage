import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { isReviewStaff } from "../utils/admin";

export default function AdminGuard({ children }) {
  const { user, userProfile, loading } = useAuth();

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

  // If user is logged in but not admin/editor -> Kick to Home
  if (user && !isReviewStaff(user, userProfile)) {
    return <Navigate to="/" replace />;
  }

  // If not logged in -> Kick to Admin Login
  if (!user) {
      return <Navigate to="/admin-login" replace />;
  }

  return children;
}
