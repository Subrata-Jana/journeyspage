// src/contexts/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateEmail as fbUpdateEmail,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile as fbUpdateProfile, 
} from "firebase/auth";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "../services/firebase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(null);

  // 🔁 Load or create profile
  const loadOrCreateProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      return;
    }

    try {
      const refDoc = doc(db, "users", firebaseUser.uid);
      const snap = await getDoc(refDoc);

      if (snap.exists()) {
        setUserProfile(snap.data());
      } else {
        // 🛡️ AUTO-CREATE PROFILE
        const profile = {
          name: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
          avatarUrl: "",
          onboarded: false,
          darkMode: false,
          level: 1,
          points: 0,
          badges: [],
          createdAt: serverTimestamp(),
        };

        await setDoc(refDoc, profile);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }, []);

  // 🔐 Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadOrCreateProfile(firebaseUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsub;
  }, [loadOrCreateProfile]);

  // ======================
  // AUTH ACTIONS
  // ======================
  const login = useCallback((email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  }, []);

  const register = useCallback(async (email, password, name = "") => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update Firebase Auth Profile
    if (name) await fbUpdateProfile(cred.user, { displayName: name });

    const profile = {
      name,
      email,
      avatarUrl: "",
      onboarded: false,
      darkMode: false,
      level: 1,
      points: 0,
      badges: [],
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, "users", cred.user.uid), profile);
    setUserProfile(profile);

    return cred;
  }, []);

  // 👇 FIXED LOGOUT FUNCTION
  const logout = useCallback(async () => {
    setUser(null);          // 1. Clear State
    setUserProfile(null);   // 2. Clear Profile
    await signOut(auth);    // 3. Clear Firebase Session
  }, []);

  const resetPassword = useCallback(
    (email) => sendPasswordResetEmail(auth, email),
    []
  );

  // ======================
  // PROFILE ACTIONS
  // ======================
  const uploadAvatar = useCallback(
    async (file) => {
      if (!user?.uid) throw new Error("Not authenticated");

      const filename = `${Date.now()}-${file.name}`;
      const path = `avatars/${user.uid}/${filename}`;
      const storageRef = ref(storage, path);

      setAvatarUploadProgress(0);

      const snap = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snap.ref);

      await updateDoc(doc(db, "users", user.uid), { avatarUrl: url });
      setUserProfile((p) => ({ ...p, avatarUrl: url }));

      setAvatarUploadProgress(null);
      return url;
    },
    [user]
  );

  const updateProfileName = useCallback(
    async (name) => {
      if (!user?.uid) throw new Error("Not authenticated");
      await updateDoc(doc(db, "users", user.uid), { name });
      setUserProfile((p) => ({ ...p, name }));
    },
    [user]
  );

  const updateProfileEmail = useCallback(async (newEmail) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    await fbUpdateEmail(auth.currentUser, newEmail);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { email: newEmail });
    setUserProfile((p) => ({ ...p, email: newEmail }));
  }, []);

  const updateProfilePassword = useCallback(async (newPassword) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    await fbUpdatePassword(auth.currentUser, newPassword);
  }, []);

  const reauthenticate = useCallback(async (currentPassword) => {
    if (!auth.currentUser?.email) throw new Error("Not authenticated");
    const cred = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword
    );
    return reauthenticateWithCredential(auth.currentUser, cred);
  }, []);

  const updateDarkMode = useCallback(
    async (value) => {
      if (!user?.uid) throw new Error("Not authenticated");
      await updateDoc(doc(db, "users", user.uid), { darkMode: !!value });
      setUserProfile((p) => ({ ...p, darkMode: !!value }));
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      avatarUploadProgress,
      login,
      register,
      logout,
      resetPassword,
      uploadAvatar,
      updateProfileName,
      updateProfileEmail,
      updateProfilePassword,
      updateDarkMode,
      reauthenticate,
    }),
    [user, userProfile, loading, avatarUploadProgress, login, register, logout, resetPassword, uploadAvatar, updateProfileName, updateProfileEmail, updateProfilePassword, updateDarkMode, reauthenticate]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;