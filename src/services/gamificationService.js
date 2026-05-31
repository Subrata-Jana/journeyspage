import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const call = (name) => httpsCallable(functions, name);

const invoke = async (name, payload = {}) => {
  try {
    const result = await call(name)(payload);
    return { success: true, ...result.data };
  } catch (error) {
    console.error(`${name} failed:`, error);
    return {
      success: false,
      error: error?.message || String(error),
      message: error?.message || "Action failed. Please try again.",
    };
  }
};

export const calculateLevel = (xp) => {
  if (!xp || xp < 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

export const toggleStoryLike = async (storyId) =>
  invoke("toggleStoryLike", { storyId });

export const toggleUserTrack = async (targetUserId) =>
  invoke("toggleUserTrack", { targetUserId });

export const trackShare = async (storyId) =>
  invoke("trackStoryShare", { storyId });

export const requestTreasureOffer = async (storyId) =>
  invoke("requestTreasureOffer", { storyId });

export const collectLoot = async (storyId) =>
  invoke("claimTreasure", { storyId });

export const sendTribute = async (_senderId, _authorId, storyId, item, message) =>
  invoke("sendTribute", {
    storyId,
    obtainedAt: item?.obtainedAt || "",
    itemId: item?.itemId || "",
    message: message || "",
  });

export const processUserSession = async () => invoke("processUserSession");

export const syncUserGamification = async (userId) =>
  invoke("syncUserGamification", { userId });

export const recordStoryView = async (storyId) =>
  invoke("recordStoryView", { storyId });
