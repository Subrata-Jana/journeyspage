// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"; 
import { AuthProvider } from "./contexts/AuthContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CommunityGuidelines from "./pages/CommunityGuidelines";
import CopyrightPolicy from "./pages/CopyrightPolicy";

import Dashboard from "./pages/Dashboard";
import CreateStory from "./pages/CreateStory";
import StoryDetail from "./pages/StoryDetail";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminGuard from "./components/AdminGuard";

import Header from "./components/Header";
import Footer from "./components/Footer";
import Seo from "./components/Seo";

const publicPageSeo = {
  "/": {
    title: "JourneysPage | Curated Travel Stories",
    description:
      "Discover approved travel journeys and share structured stories from real routes, places, and experiences.",
  },
  "/about": {
    title: "About JourneysPage | Curated Travel Storytelling",
    description:
      "Learn how JourneysPage combines moderated publishing, destination-led storytelling, and creator community features.",
  },
  "/contact": {
    title: "Contact JourneysPage | Support And Platform Help",
    description:
      "Find the right support path for JourneysPage account, story review, trust, safety, and technical questions.",
  },
  "/privacy": {
    title: "Privacy Policy | JourneysPage",
    description:
      "Review how JourneysPage handles account, profile, story, moderation, and community interaction data.",
  },
  "/terms": {
    title: "Terms Of Service | JourneysPage",
    description:
      "Review the terms for using JourneysPage, publishing travel stories, account access, moderation, and community features.",
  },
  "/guidelines": {
    title: "Community Guidelines | JourneysPage",
    description:
      "Review JourneysPage creator rules, publishing standards, content safety expectations, and do-and-don't guidance.",
  },
  "/copyright": {
    title: "Copyright Policy | JourneysPage",
    description:
      "Review JourneysPage copyright rules, creator ownership requirements, infringement reporting, and content removal process.",
  },
  "/login": {
    title: "Login | JourneysPage",
    description: "Log in to manage your JourneysPage stories, profile, and travel community activity.",
  },
  "/admin-login": {
    title: "Admin Login | JourneysPage",
    description: "Secure login for JourneysPage admins and editors to review stories and manage platform settings.",
  },
  "/register": {
    title: "Join JourneysPage | Create Travel Stories",
    description: "Create a JourneysPage account to write, submit, and share curated travel stories.",
  },
};

// ⚡ INTERNAL LAYOUT COMPONENT
function Layout() {
  const location = useLocation();
  const seo = publicPageSeo[location.pathname] || {
    title: "JourneysPage",
    description:
      "A curated travel storytelling community for discovering approved journeys and publishing structured trip stories.",
  };

  // Define routes where we want the FULL SCREEN application feel
  const isAppRoute =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/create-story") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/profile") ||
    location.pathname.startsWith("/story/");
  const isAuthRoute =
    location.pathname === "/login" ||
    location.pathname === "/admin-login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password";
  const hasStandaloneLayout = isAppRoute || isAuthRoute;

  return (
    <>
      <Seo title={seo.title} description={seo.description} path={location.pathname} />

      {/* 1. Only show Global Header on public landing surfaces */}
      {!hasStandaloneLayout && <Header />}

      <main className={hasStandaloneLayout ? "" : "pt-[68px] min-h-screen"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/guidelines" element={<CommunityGuidelines />} />
          <Route path="/copyright" element={<CopyrightPolicy />} />
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
              <ProtectedRoute redirectTo="/admin-login">
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
