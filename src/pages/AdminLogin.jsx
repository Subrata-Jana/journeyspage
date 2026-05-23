import { useState } from "react";
import { ArrowRight, Lock, Mail, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import AuthCard from "../components/ui/AuthCard";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { isReviewStaff } from "../utils/admin";

function hasApiKeyError(message = "") {
  const normalized = message.toLowerCase();
  return normalized.includes("api key") || normalized.includes("api_key");
}

function getAdminLoginErrorMessage(code, message = "") {
  if (hasApiKeyError(message)) {
    return "Firebase API key is not valid for this app.";
  }

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many login attempts. Please try again later.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase API key is not valid for this app.";
    default:
      return "Unable to log in. Please try again.";
  }
}

export default function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cred = await login(form.email.trim(), form.password);
      const profileSnap = await getDoc(doc(db, "users", cred.user.uid));
      const profile = profileSnap.exists() ? profileSnap.data() : null;

      if (!isReviewStaff(cred.user, profile)) {
        await logout();
        setError("Admin or editor access is required for this area.");
        return;
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      console.error("admin login failed", err);
      setError(getAdminLoginErrorMessage(err.code, err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat p-4"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=2070&auto=format&fit=crop')",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/20 text-orange-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">Admin Access</h1>
          <p className="mt-2 text-sm text-gray-300">Moderation and platform management.</p>
        </div>

        <AuthCard title="Admin / Editor Login">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              icon={Mail}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              required
            />
            <Input
              icon={Lock}
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="current-password"
              required
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-gray-400 transition-colors hover:text-orange-400"
              >
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Enter Admin Panel"}
            </Button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm font-semibold text-orange-400 transition-colors hover:text-orange-300 hover:underline"
            >
              Member login <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
