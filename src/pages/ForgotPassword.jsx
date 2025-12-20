// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Mail, MapPin, ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import AuthCard from "../components/ui/AuthCard";
import { Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await resetPassword(email);

      toast.success("Password reset link sent! Check your inbox.");
      setEmail("");
    } catch (err) {
      // Firebase error mapping
      const msg =
        err.code === "auth/user-not-found"
          ? "No account found with this email."
          : "Unable to send reset email. Try again.";

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 relative animate-fadeIn"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop')",
      }}
    >
      <Toaster position="top-center" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

      <div className="relative z-10 w-full max-w-md animate-slideUp">
        {/* Brand Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 mb-4 border border-orange-500/30">
            <MapPin className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Account Recovery
          </h1>
          <p className="text-gray-300 mt-2 text-sm">
            We’ll help you get back on track.
          </p>
        </div>

        {/* Glass Card */}
        <AuthCard title="Reset Password">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-gray-400 text-sm text-center mb-2">
              Enter your email address and we will send you a reset link.
            </div>

            <Input
              icon={Mail}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />

            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <Link
              to="/login"
              className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Login
            </Link>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
