const crypto = require("crypto");
const {setGlobalOptions} = require("firebase-functions/v2");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({region: "asia-south1", maxInstances: 10});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const POINTS = {
  LIKE_GIVER: 2,
  LIKE_AUTHOR: 10,
  TRACK_GIVER: 5,
  TRACK_RECEIVER: 15,
  SHARE_GIVER: 20,
  DAILY_LOGIN: 20,
  RARITY: {COMMON: 10, UNCOMMON: 50, RARE: 100, LEGENDARY: 500},
};

const requireAuth = (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  return request.auth.uid;
};

const requireVerifiedAuth = (request) => {
  const uid = requireAuth(request);
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Please verify your email before using community features.");
  }
  return uid;
};

const cleanText = (value, maxLength = 240) =>
  String(value || "").trim().slice(0, maxLength);

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getItems = (snap) => Array.isArray(snap?.data()?.items) ? snap.data().items : [];

const rankForXp = (ranks, xp) => {
  const sorted = [...ranks].sort(
    (a, b) => asNumber(a.threshold, a.minXP) - asNumber(b.threshold, b.minXP)
  );
  return sorted.reduce(
    (selected, rank) =>
      xp >= asNumber(rank.threshold, rank.minXP) ? rank : selected,
    sorted[0] || null
  );
};

const cleanInventory = (inventory = []) => {
  const now = Date.now();
  return inventory.filter((item) => {
    if (typeof item === "string") return true;
    return !item?.expiresAt || Date.parse(item.expiresAt) > now;
  });
};

const addXpPatch = (userData, delta, ranks, extra = {}) => {
  const xp = Math.max(0, asNumber(userData?.xp) + delta);
  const currentRank = rankForXp(ranks, xp);
  return {...extra, xp, ...(currentRank ? {currentRank} : {})};
};

const notificationData = ({
  recipientId,
  type = "info",
  title,
  message,
  link = "",
  actorId = "",
  actorName = "",
  entityType = "",
  entityId = "",
  channel = "social",
  meta = {},
  userNote = "",
}) => ({
  recipientId,
  type,
  title,
  message,
  link,
  actorId,
  actorName,
  entityType,
  entityId,
  channel,
  meta,
  ...(userNote ? {userNote} : {}),
  read: false,
  createdAt: FieldValue.serverTimestamp(),
});

const isAdmin = async (uid, email = "") => {
  if (String(email).toLowerCase() === "sjsubratajana@gmail.com") return true;
  const userSnap = await db.doc(`users/${uid}`).get();
  return userSnap.data()?.role === "admin";
};

async function syncGamification(userId) {
  if (!userId) return;
  const [userSnap, storiesSnap, ranksSnap, badgesSnap] = await Promise.all([
    db.doc(`users/${userId}`).get(),
    db.collection("stories").where("authorId", "==", userId).where("status", "==", "approved").get(),
    db.doc("meta/ranks").get(),
    db.doc("meta/badges").get(),
  ]);
  if (!userSnap.exists) return;

  const stats = {stories: storiesSnap.size, likes: 0, shares: 0, places: new Set()};
  storiesSnap.forEach((storyDoc) => {
    const story = storyDoc.data();
    stats.likes += asNumber(story.likeCount, Array.isArray(story.likes) ? story.likes.length : 0);
    stats.shares += asNumber(story.shareCount, Array.isArray(story.sharedBy) ? story.sharedBy.length : 0);
    const place = story.locationData?.value?.place_id || cleanText(story.location, 160).toLowerCase();
    if (place) stats.places.add(place);
  });

  const userData = userSnap.data();
  const ranks = getItems(ranksSnap);
  const badges = [...(Array.isArray(userData.badges) ? userData.badges : [])];
  let xp = asNumber(userData.xp);

  getItems(badgesSnap).forEach((rule) => {
    if (badges.some((badge) => badge.id === rule.id && badge.isUnlocked)) return;
    const metric = rule.metric || "stories";
    const value = metric === "likes" ? stats.likes :
      metric === "shares" ? stats.shares :
        metric === "places" ? stats.places.size : stats.stories;
    if (value < asNumber(rule.threshold, rule.value)) return;
    xp += asNumber(rule.xpReward, rule.xp || 50);
    badges.push({
      id: rule.id,
      name: rule.name,
      icon: rule.icon,
      description: rule.description,
      color: rule.color,
      isUnlocked: true,
      unlockedAt: new Date().toISOString(),
    });
  });

  const currentRank = rankForXp(ranks, xp);
  const authorRank = currentRank?.name || userData.currentRank?.name || userData.currentRank || "Scout";
  const authorPhoto = userData.photoURL || userData.avatarUrl || userData.profilePhoto || userData.avatar || "";
  const batch = db.batch();
  batch.update(userSnap.ref, {
    xp,
    badges,
    inventory: cleanInventory(userData.inventory),
    ...(currentRank ? {currentRank} : {}),
    stats: {stories: stats.stories, likes: stats.likes, shares: stats.shares, places: stats.places.size},
  });
  storiesSnap.forEach((storyDoc) => {
    const story = storyDoc.data();
    const patch = {};
    if (story.authorRank !== authorRank) patch.authorRank = authorRank;
    if (authorPhoto && story.authorPhoto !== authorPhoto) patch.authorPhoto = authorPhoto;
    if (Object.keys(patch).length) batch.update(storyDoc.ref, patch);
  });
  await batch.commit();
}

exports.toggleStoryLike = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  const storyId = cleanText(request.data?.storyId, 120);
  if (!storyId) throw new HttpsError("invalid-argument", "Story is required.");

  return db.runTransaction(async (tx) => {
    const storyRef = db.doc(`stories/${storyId}`);
    const userRef = db.doc(`users/${uid}`);
    const rewardRef = db.doc(`gamificationActions/like_${storyId}_${uid}`);
    const ranksRef = db.doc("meta/ranks");
    const storySnap = await tx.get(storyRef);
    if (!storySnap.exists || storySnap.data().status !== "approved") {
      throw new HttpsError("not-found", "Story is unavailable.");
    }
    const story = storySnap.data();
    if (story.authorId === uid) {
      throw new HttpsError("failed-precondition", "You cannot like your own story.");
    }
    const authorRef = uid !== story.authorId ? db.doc(`users/${story.authorId}`) : null;
    const [userSnap, rewardSnap, ranksSnap, authorSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(rewardRef),
      tx.get(ranksRef),
      authorRef ? tx.get(authorRef) : Promise.resolve(null),
    ]);
    const likes = Array.isArray(story.likes) ? story.likes : [];
    const hasLiked = likes.includes(uid);
    if (hasLiked) {
      tx.update(storyRef, {likes: FieldValue.arrayRemove(uid), likeCount: Math.max(0, asNumber(story.likeCount, likes.length) - 1)});
      return {addedLike: false, xpGained: 0};
    }

    const ranks = getItems(ranksSnap);
    const firstReward = !rewardSnap.exists;
    tx.update(storyRef, {likes: FieldValue.arrayUnion(uid), likeCount: asNumber(story.likeCount, likes.length) + 1});
    if (firstReward && userSnap.exists) {
      tx.update(userRef, addXpPatch(userSnap.data(), POINTS.LIKE_GIVER, ranks));
      tx.create(rewardRef, {type: "like", storyId, userId: uid, createdAt: FieldValue.serverTimestamp()});
    }
    if (uid !== story.authorId) {
      if (firstReward && authorSnap.exists) tx.update(authorRef, addXpPatch(authorSnap.data(), POINTS.LIKE_AUTHOR, ranks));
      tx.create(db.collection("notifications").doc(), notificationData({
        recipientId: story.authorId,
        type: "like",
        title: "New Like",
        message: `${userSnap.data()?.name || "A traveler"} liked "${cleanText(story.title, 100)}"`,
        link: `/story/${storyId}`,
        actorId: uid,
        actorName: userSnap.data()?.name || "A traveler",
        entityType: "story",
        entityId: storyId,
      }));
    }
    return {addedLike: true, xpGained: firstReward ? POINTS.LIKE_GIVER : 0};
  });
});

exports.toggleUserTrack = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  const targetUserId = cleanText(request.data?.targetUserId, 120);
  if (!targetUserId || targetUserId === uid) throw new HttpsError("invalid-argument", "Choose another traveler.");
  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const targetRef = db.doc(`users/${targetUserId}`);
    const rewardRef = db.doc(`gamificationActions/track_${targetUserId}_${uid}`);
    const ranksRef = db.doc("meta/ranks");
    const [userSnap, targetSnap, rewardSnap, ranksSnap] = await Promise.all([
      tx.get(userRef), tx.get(targetRef), tx.get(rewardRef), tx.get(ranksRef),
    ]);
    if (!userSnap.exists || !targetSnap.exists) throw new HttpsError("not-found", "Traveler is unavailable.");
    const ranks = getItems(ranksSnap);
    const target = targetSnap.data();
    const trackers = Array.isArray(target.trackers) ? target.trackers : [];
    const isTracking = trackers.includes(uid);
    if (isTracking) {
      tx.update(targetRef, {trackers: FieldValue.arrayRemove(uid), trackersCount: Math.max(0, asNumber(target.trackersCount, trackers.length) - 1)});
      tx.update(userRef, {tracking: FieldValue.arrayRemove(targetUserId)});
      return {isTracking: false, xpGained: 0};
    }
    const firstReward = !rewardSnap.exists;
    tx.update(targetRef, {
      trackers: FieldValue.arrayUnion(uid),
      trackersCount: asNumber(target.trackersCount, trackers.length) + 1,
      ...(firstReward ? addXpPatch(target, POINTS.TRACK_RECEIVER, ranks) : {}),
    });
    tx.update(userRef, {
      tracking: FieldValue.arrayUnion(targetUserId),
      ...(firstReward ? addXpPatch(userSnap.data(), POINTS.TRACK_GIVER, ranks) : {}),
    });
    if (firstReward) tx.create(rewardRef, {type: "track", targetUserId, userId: uid, createdAt: FieldValue.serverTimestamp()});
    tx.create(db.collection("notifications").doc(), notificationData({
      recipientId: targetUserId,
      type: "track",
      title: "New Tracker",
      message: `${userSnap.data().name || "A traveler"} started tracking you.`,
      link: `/profile/${uid}`,
      actorId: uid,
      actorName: userSnap.data().name || "A traveler",
      entityType: "profile",
      entityId: uid,
    }));
    return {isTracking: true, xpGained: firstReward ? POINTS.TRACK_GIVER : 0};
  });
});

exports.trackStoryShare = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  const storyId = cleanText(request.data?.storyId, 120);
  return db.runTransaction(async (tx) => {
    const storyRef = db.doc(`stories/${storyId}`);
    const userRef = db.doc(`users/${uid}`);
    const rewardRef = db.doc(`gamificationActions/share_${storyId}_${uid}`);
    const ranksRef = db.doc("meta/ranks");
    const [storySnap, userSnap, rewardSnap, ranksSnap] = await Promise.all([
      tx.get(storyRef), tx.get(userRef), tx.get(rewardRef), tx.get(ranksRef),
    ]);
    if (!storySnap.exists || storySnap.data().status !== "approved") throw new HttpsError("not-found", "Story is unavailable.");
    if (rewardSnap.exists) return {shared: false, alreadyShared: true, xpGained: 0};
    const story = storySnap.data();
    tx.update(storyRef, {sharedBy: FieldValue.arrayUnion(uid), shareCount: asNumber(story.shareCount) + 1});
    if (userSnap.exists) tx.update(userRef, addXpPatch(userSnap.data(), POINTS.SHARE_GIVER, getItems(ranksSnap)));
    tx.create(rewardRef, {type: "share", storyId, userId: uid, createdAt: FieldValue.serverTimestamp()});
    return {shared: true, alreadyShared: false, xpGained: POINTS.SHARE_GIVER};
  });
});

exports.recordStoryView = onCall(async (request) => {
  const storyId = cleanText(request.data?.storyId, 120);
  if (!storyId) throw new HttpsError("invalid-argument", "Story is required.");
  const day = new Date().toISOString().slice(0, 10);
  const identity = request.auth?.uid || request.rawRequest.ip || "anonymous";
  const viewer = crypto.createHash("sha256").update(`${identity}_${day}`).digest("hex").slice(0, 24);
  const viewRef = db.doc(`storyViewActions/${storyId}_${viewer}`);
  const storyRef = db.doc(`stories/${storyId}`);
  return db.runTransaction(async (tx) => {
    const [viewSnap, storySnap] = await Promise.all([tx.get(viewRef), tx.get(storyRef)]);
    if (!storySnap.exists || storySnap.data().status !== "approved") return {recorded: false};
    if (viewSnap.exists) return {recorded: false};
    tx.create(viewRef, {storyId, viewer, day, createdAt: FieldValue.serverTimestamp()});
    tx.update(storyRef, {views: asNumber(storySnap.data().views) + 1});
    return {recorded: true};
  });
});

exports.requestTreasureOffer = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  const storyId = cleanText(request.data?.storyId, 120);
  const offerRef = db.doc(`treasureOffers/${storyId}_${uid}`);
  return db.runTransaction(async (tx) => {
    const storyRef = db.doc(`stories/${storyId}`);
    const lootRef = db.doc("meta/loot");
    const [storySnap, offerSnap, lootSnap] = await Promise.all([tx.get(storyRef), tx.get(offerRef), tx.get(lootRef)]);
    if (!storySnap.exists || storySnap.data().status !== "approved") return {offered: false};
    if (offerSnap.exists) return {offered: !!offerSnap.data().offered && !offerSnap.data().claimed, item: offerSnap.data().item || null};
    const loot = getItems(lootSnap);
    const offered = loot.length > 0 && Math.random() < 0.15;
    const item = offered ? loot[Math.floor(Math.random() * loot.length)] : null;
    const safeItem = item ? {id: item.id, name: item.name, icon: item.icon, rarity: item.rarity} : null;
    tx.create(offerRef, {storyId, userId: uid, offered, claimed: false, item: safeItem, createdAt: FieldValue.serverTimestamp()});
    return {offered, item: safeItem};
  });
});

exports.claimTreasure = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  const storyId = cleanText(request.data?.storyId, 120);
  return db.runTransaction(async (tx) => {
    const offerRef = db.doc(`treasureOffers/${storyId}_${uid}`);
    const userRef = db.doc(`users/${uid}`);
    const lootRef = db.doc("meta/loot");
    const ranksRef = db.doc("meta/ranks");
    const [offerSnap, userSnap, lootSnap, ranksSnap] = await Promise.all([
      tx.get(offerRef), tx.get(userRef), tx.get(lootRef), tx.get(ranksRef),
    ]);
    const offer = offerSnap.data();
    if (!offerSnap.exists || !offer.offered || offer.claimed) throw new HttpsError("failed-precondition", "This treasure is unavailable.");
    const item = getItems(lootSnap).find((candidate) => candidate.id === offer.item?.id);
    if (!item || !userSnap.exists) throw new HttpsError("not-found", "Treasure is unavailable.");
    const xpGained = asNumber(item.points, POINTS.RARITY[String(item.rarity || "COMMON").toUpperCase()] || 10);
    const expiryHours = asNumber(item.expiryHours, String(item.rarity).toUpperCase() === "LEGENDARY" ? 720 : 24);
    const obtainedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
    const inventory = cleanInventory(userSnap.data().inventory);
    tx.update(userRef, addXpPatch(userSnap.data(), xpGained, getItems(ranksSnap), {
      inventory: [...inventory, {itemId: item.id, name: item.name, icon: item.icon, rarity: item.rarity, obtainedAt, expiresAt, source: "story_treasure"}],
    }));
    tx.update(offerRef, {claimed: true, claimedAt: FieldValue.serverTimestamp()});
    return {message: `Found: ${item.name}`, xpGained, item: offer.item};
  });
});

exports.sendTribute = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  const storyId = cleanText(request.data?.storyId, 120);
  const obtainedAt = cleanText(request.data?.obtainedAt, 80);
  const itemId = cleanText(request.data?.itemId, 100);
  const userNote = cleanText(request.data?.message, 300);
  return db.runTransaction(async (tx) => {
    const storyRef = db.doc(`stories/${storyId}`);
    const senderRef = db.doc(`users/${uid}`);
    const ranksRef = db.doc("meta/ranks");
    const [storySnap, senderSnap, ranksSnap] = await Promise.all([tx.get(storyRef), tx.get(senderRef), tx.get(ranksRef)]);
    const story = storySnap.data();
    if (!storySnap.exists || story.status !== "approved" || story.authorId === uid) throw new HttpsError("failed-precondition", "Tribute cannot be sent.");
    const authorRef = db.doc(`users/${story.authorId}`);
    const authorSnap = await tx.get(authorRef);
    if (!senderSnap.exists || !authorSnap.exists) throw new HttpsError("not-found", "Traveler is unavailable.");
    const inventory = cleanInventory(senderSnap.data().inventory);
    const itemIndex = inventory.findIndex((item) => item?.itemId === itemId && item?.obtainedAt === obtainedAt);
    if (itemIndex < 0) throw new HttpsError("failed-precondition", "This treasure expired or is unavailable.");
    const item = inventory[itemIndex];
    const base = POINTS.RARITY[String(item.rarity || "COMMON").toUpperCase()] || 10;
    const senderXp = Math.floor(base * 0.2);
    const authorXp = base;
    inventory.splice(itemIndex, 1);
    const trophies = [...(Array.isArray(authorSnap.data().trophies) ? authorSnap.data().trophies : [])];
    const trophy = trophies.find((entry) => entry.name === item.name);
    if (trophy) trophy.count = asNumber(trophy.count, 1) + 1;
    else trophies.push({name: item.name, icon: item.icon, rarity: item.rarity, count: 1});
    const ranks = getItems(ranksSnap);
    tx.update(senderRef, addXpPatch(senderSnap.data(), senderXp, ranks, {inventory}));
    tx.update(authorRef, addXpPatch(authorSnap.data(), authorXp, ranks, {trophies}));
    tx.update(storyRef, {giftCount: asNumber(story.giftCount) + 1, tributeCount: asNumber(story.tributeCount) + 1});
    tx.create(db.collection("notifications").doc(), notificationData({
      recipientId: story.authorId,
      type: "gift",
      title: "New Tribute",
      message: `${senderSnap.data().name || "A traveler"} sent you a ${item.rarity} ${item.name}.`,
      link: `/story/${storyId}`,
      actorId: uid,
      actorName: senderSnap.data().name || "A traveler",
      entityType: "story",
      entityId: storyId,
      meta: {storyId, storyTitle: story.title, senderXp, authorXp},
      userNote,
    }));
    return {sent: true};
  });
});

exports.processUserSession = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const lootRef = db.doc("meta/loot");
    const ranksRef = db.doc("meta/ranks");
    const [userSnap, lootSnap, ranksSnap] = await Promise.all([tx.get(userRef), tx.get(lootRef), tx.get(ranksRef)]);
    if (!userSnap.exists) return {rewarded: false};
    const today = new Date().toISOString().slice(0, 10);
    if (userSnap.data().lastLoginDate === today) return {rewarded: false};
    const common = getItems(lootSnap).filter((item) => !item.rarity || String(item.rarity).toLowerCase() === "common");
    const reward = common.length ? common[Math.floor(Math.random() * common.length)] : null;
    const inventory = cleanInventory(userSnap.data().inventory);
    if (reward) {
      const expiryHours = asNumber(reward.expiryHours, 24);
      inventory.push({
        itemId: reward.id, name: reward.name, icon: reward.icon, rarity: reward.rarity,
        obtainedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
        source: "daily_login",
      });
    }
    tx.update(userRef, addXpPatch(userSnap.data(), POINTS.DAILY_LOGIN, getItems(ranksSnap), {lastLoginDate: today, inventory}));
    return {rewarded: true, xpGained: POINTS.DAILY_LOGIN};
  });
});

exports.syncUserGamification = onCall(async (request) => {
  const uid = requireVerifiedAuth(request);
  const userId = cleanText(request.data?.userId || uid, 120);
  if (userId !== uid && !(await isAdmin(uid, request.auth.token.email))) {
    throw new HttpsError("permission-denied", "You cannot sync another traveler.");
  }
  await syncGamification(userId);
  return {synced: true};
});

exports.syncStoryAuthorGamification = onDocumentWritten("stories/{storyId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const authorId = after?.authorId || before?.authorId;
  const approvalChanged = before?.status !== after?.status &&
    (before?.status === "approved" || after?.status === "approved");
  if (!authorId || !approvalChanged) return;
  try {
    await syncGamification(authorId);
  } catch (error) {
    logger.error("Author gamification sync failed", {authorId, error});
  }
});
