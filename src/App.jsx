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

// ❌ REMOVED: import NotificationStream... (This was causing the auto-popup)

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
  
    return (
    <>
      {/* ❌ REMOVED: <NotificationStream /> */}
      
      {/* 1. Only show Global Header if NOT on an App Route */}
      {!isAppRoute && <Header />}

      <main className={isAppRoute ? "" : "pt-16 min-h-screen"}>
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
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* 3. Only show Footer if NOT on an App Route AND NOT on Home Page */}
      {!isAppRoute && location.pathname !== "/" && <Footer />}
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