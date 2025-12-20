// src/services/profileService.js
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export function calculateLevel(points = 0) {
  if (points >= 1000) return 5;
  if (points >= 500) return 4;
  if (points >= 250) return 3;
  if (points >= 100) return 2;
  return 1;
}

export function badgesForPoints(points = 0) {
  const badges = [];
  if (points >= 250) badges.push("Explorer");
  if (points >= 500) badges.push("Trailblazer");
  if (points >= 1000) badges.push("Legend");
  return badges;
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ✅ MARK ONBOARDING COMPLETE
export async function markOnboarded(uid, extraData = {}) {
  if (!uid) throw new Error("uid-required");

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      onboarded: true,
      ...extraData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      onboarded: true,
      ...extraData,
      updatedAt: serverTimestamp(),
    });
  }
}


// ADD POINTS + LEVEL
export async function addPoints(uid, deltaPoints = 0, extraBadge = null) {
  if (!uid) throw new Error("uid-required");

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const profile = snap.exists() ? snap.data() : {};

  const newPoints = (profile.points || 0) + deltaPoints;
  const newLevel = calculateLevel(newPoints);

  const badgeSet = new Set(profile.badges || []);
  badgesForPoints(newPoints).forEach((b) => badgeSet.add(b));
  if (extraBadge) badgeSet.add(extraBadge);

  const data = {
    points: newPoints,
    level: newLevel,
    badges: Array.from(badgeSet),
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      name: profile.name || "",
      email: profile.email || "",
      avatarUrl: "",
      onboarded: false,
      createdAt: serverTimestamp(),
      ...data,
    });
  } else {
    await updateDoc(ref, data);
  }

  return data;
}
