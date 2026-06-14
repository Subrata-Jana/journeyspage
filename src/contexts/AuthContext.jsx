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
  sendEmailVerification,
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
  onSnapshot,
} from "firebase/firestore";

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import imageCompression from "browser-image-compression";

import { auth, db, storage } from "../services/firebase";
import {
  buildAvatarFields,
  getProfilePhotoUrl,
  normalizeUserProfile,
} from "../utils/userProfile";

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
        setUserProfile(normalizeUserProfile({
          ...snap.data(),
          emailVerified: !!firebaseUser.emailVerified,
          trustLevel: snap.data().trustLevel || (firebaseUser.emailVerified ? "verified" : "new"),
        }));
      } else {
        // 🛡️ AUTO-CREATE PROFILE
        const profile = normalizeUserProfile({
          name: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
          ...buildAvatarFields(""),
          onboarded: false,
          darkMode: false,
          level: 1,
          points: 0,
          badges: [],
          emailVerified: !!firebaseUser.emailVerified,
          trustLevel: firebaseUser.emailVerified ? "verified" : "new",
          createdAt: serverTimestamp(),
        });

        await setDoc(refDoc, profile);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }, []);

  // 🔐 Auth listener
  useEffect(() => {
    let profileUnsub = null;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        await loadOrCreateProfile(firebaseUser);
        profileUnsub = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            setUserProfile(normalizeUserProfile({
              ...snap.data(),
              emailVerified: !!auth.currentUser?.emailVerified,
              trustLevel: snap.data().trustLevel || (auth.currentUser?.emailVerified ? "verified" : "new"),
            }));
          }
        });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      if (profileUnsub) profileUnsub();
      unsub();
    };
  }, [loadOrCreateProfile]);

  // ======================
  // AUTH ACTIONS
  // ======================
  const login = useCallback(
    async (email, password) => {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(cred.user);
      await loadOrCreateProfile(cred.user);
      return cred;
    },
    [loadOrCreateProfile]
  );

  const register = useCallback(async (email, password, name = "") => {
    const trimmedEmail = email.trim();
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    
    // Update Firebase Auth Profile
    if (name) await fbUpdateProfile(cred.user, { displayName: name });

    const profile = normalizeUserProfile({
      name,
      email: trimmedEmail,
      ...buildAvatarFields(""),
      onboarded: false,
      darkMode: false,
      level: 1,
      points: 0,
      badges: [],
      emailVerified: false,
      trustLevel: "new",
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "users", cred.user.uid), profile);
    await sendEmailVerification(cred.user, {
      url: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
    });
    setUserProfile(profile);

    return cred;
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    await sendEmailVerification(auth.currentUser, {
      url: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
    });
  }, []);

  const refreshAuthUser = useCallback(async () => {
    if (!auth.currentUser) return null;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
    await loadOrCreateProfile(auth.currentUser);
    return auth.currentUser;
  }, [loadOrCreateProfile]);

  // 👇 FIXED LOGOUT FUNCTION
  const logout = useCallback(async () => {
    setUser(null);          // 1. Clear State
    setUserProfile(null);   // 2. Clear Profile
    await signOut(auth);    // 3. Clear Firebase Session
  }, []);

  const resetPassword = useCallback(
    (email) => sendPasswordResetEmail(auth, email.trim()),
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
      const previousUrl = getProfilePhotoUrl(userProfile);
      const optimizedFile = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.86,
      });

      setAvatarUploadProgress(0);

      const snap = await uploadBytes(storageRef, optimizedFile, {
        cacheControl: "public,max-age=31536000,immutable",
        contentType: optimizedFile.type || "image/jpeg",
      });
      const url = await getDownloadURL(snap.ref);

      const avatarFields = buildAvatarFields(url);
      await updateDoc(doc(db, "users", user.uid), avatarFields);
      if (previousUrl && previousUrl !== url) {
        try {
          await deleteObject(ref(storage, previousUrl));
        } catch {
          // A legacy photo can be external or already removed.
        }
      }
      setUserProfile((p) => normalizeUserProfile({ ...p, ...avatarFields }));

      setAvatarUploadProgress(null);
      return url;
    },
    [user, userProfile]
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
      sendVerificationEmail,
      refreshAuthUser,
      uploadAvatar,
      updateProfileName,
      updateProfileEmail,
      updateProfilePassword,
      updateDarkMode,
      reauthenticate,
    }),
    [user, userProfile, loading, avatarUploadProgress, login, register, logout, resetPassword, sendVerificationEmail, refreshAuthUser, uploadAvatar, updateProfileName, updateProfileEmail, updateProfilePassword, updateDarkMode, reauthenticate]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
