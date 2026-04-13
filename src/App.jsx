// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"; 
import { AuthProvider } from "./contexts/AuthContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";

import Dashboard from "./pages/Dashboard";
import CreateStory from "./pages/CreateStory";
import StoryDetail from "./pages/StoryDetail";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminGuard from "./components/AdminGuard";

import Header from "./components/Header";
import Footer from "./components/Footer";

// ⚡ INTERNAL LAYOUT COMPONENT
function Layout() {
  const location = useLocation();

  // Define routes where we want the FULL SCREEN application feel
  const isAppRoute =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/create-story") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/profile") ||
    location.pathname.startsWith("/story/");
  const isAuthRoute =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password";
  const hasStandaloneLayout = isAppRoute || isAuthRoute;

  return (
    <>
      {/* 1. Only show Global Header on public landing surfaces */}
      {!hasStandaloneLayout && <Header />}

      <main className={hasStandaloneLayout ? "" : "pt-16 min-h-screen"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/story/:storyId" element={<StoryDetail />} />

          {/* PROTECTED APP ROUTES */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-story"
            element={
              <ProtectedRoute>
                <CreateStory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminGuard>
                  <AdminPanel />
                </AdminGuard>
              </ProtectedRoute>
            }
          />
          
          {/* UPDATED PROFILE ROUTES */}
          <Route
            path="/profile" // Own profile
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:userId" // Other user's profile
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* 2. Show Footer on public marketing pages, including Home */}
      {!hasStandaloneLayout && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  );
}
