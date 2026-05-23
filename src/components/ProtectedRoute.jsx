// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children, redirectTo = "/login" }) {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );

  if (!user) return <Navigate to={redirectTo} replace />;

  return children;
}
