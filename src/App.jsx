// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"; // Import useLocation
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


// 👇 COMMENT THIS OUT LIKE THIS:
// import UploadData from "./UploadData";



// ⚡ INTERNAL LAYOUT COMPONENT
// This handles hiding the header/footer on specific pages
function Layout() {
  const location = useLocation();

  // Define routes where we want the FULL SCREEN application feel
  // (No global white header, no global footer, no extra padding)
  const isAppRoute = 
    location.pathname.startsWith("/dashboard") || 
    location.pathname.startsWith("/create-story") || 
    location.pathname.startsWith("/admin") || 
    location.pathname.startsWith("/profile") ||
    location.pathname.startsWith("/story/"); // 👈 Fixed: Changed ; to || so this line works
  
    return (
    <>
        
    {/* 👇 COMMENT THIS OUT LIKE THIS: */}
      {/*} <UploadData /> */}
      

      {/* 1. Only show Global Header if NOT on an App Route */}
      {!isAppRoute && <Header />}

      {/* 2. Conditional Styling:
          - Normal Pages: Add 'pt-16' to push content below fixed header.
          - App Pages: No padding, let the page handle its own full-screen layout.
      */}
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
          {/* 👇 NEW ROUTE ADDED (For "Viewing Other Profiles") */}
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
        {/* Render the Layout inside BrowserRouter so useLocation works */}
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  );
}