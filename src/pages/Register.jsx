// src/pages/Register.jsx
import React, { useState } from "react";
import { Mail, Lock, User, MapPin } from "lucide-react";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import AuthCard from "../components/ui/AuthCard";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import toast, { Toaster } from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const validateForm = () => {
    if (!form.name.trim()) return "Full Name is required";
    if (!form.email.includes("@")) return "Enter a valid email address";
    if (form.password.length < 6) return "Password must be at least 6 characters";
    if (form.password !== form.confirm) return "Passwords do not match";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateForm();
    if (err) return toast.error(err);

    try {
      setLoading(true);
      // NOTE: register(email, password, name) creates user and profile doc
      await register(form.email, form.password, form.name.trim());
      toast.success("Account created — redirecting...");
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (error) {
      console.error("register failed", error);
      toast.error(error?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 relative animate-fadeIn"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop')",
      }}
    >
      <Toaster position="top-center" />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

      <div className="relative z-10 w-full max-w-md animate-slideUp">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-lg">
            <MapPin className="w-7 h-7" />
          </div>
          <h1 className="text-4xl font-bold text-white mt-3 tracking-tight drop-shadow">JourneysPage</h1>
          <p className="text-gray-300 mt-2 text-sm">Join thousands of explorers across the world.</p>
        </div>

        <AuthCard title="Create Account">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input icon={User} placeholder="Full Name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
            <Input icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            <Input icon={Lock} placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            <Input icon={Lock} placeholder="Confirm Password" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />

            <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Start Your Journey"}</Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-gray-400 text-sm">
              Already a member?{" "}
              <Link to="/login" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
