import { useState } from "react";
import { Mail, Lock, MapPin, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button"; // Now using your custom glass button
import AuthCard from "../components/ui/AuthCard";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // Added loading state for better UX

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // 1. Cinematic Background Wrapper
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 relative"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop')" }}
    >
      {/* Dark Overlay for readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

      <div className="relative z-10 w-full max-w-md">
        
        {/* 2. Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 mb-4 border border-orange-500/30">
            <MapPin className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-gray-300 mt-2 text-sm">Continue your journey with us.</p>
        </div>

        {/* 3. The Glass Card */}
        <AuthCard title="Member Login">
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              icon={Mail}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />

            <Input
              icon={Lock}
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link 
                to="/forgot-password" 
                className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button (Uses your new orange/red gradient style) */}
            <Button type="submit" disabled={loading}>
              {loading ? "Signing In..." : "Log In"}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-gray-400 text-sm">
              Don't have an account?{" "}
              <Link 
                to="/register" 
                className="text-orange-400 hover:text-orange-300 font-semibold transition-colors hover:underline inline-flex items-center gap-1"
              >
                Join Now <ArrowRight className="w-4 h-4" />
              </Link>
            </p>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}