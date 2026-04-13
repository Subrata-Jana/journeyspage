import { collection, deleteDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "./firebase";
import { syncUserGamification } from "./gamificationService";

function addStorageRef(storageRefs, url) {
  if (!url) return;

  try {
    storageRefs.push(ref(storage, url));
  } catch (error) {
    console.warn("Skipping invalid storage reference during story cleanup:", url);
  }
}

export async function deleteStoryWithAssets(storyId) {
  if (!storyId) throw new Error("story-id-required");

  const storyRef = doc(db, "stories", storyId);
  const [storySnap, daysSnap, commentsSnap] = await Promise.all([
    getDoc(storyRef),
    getDocs(collection(db, "stories", storyId, "days")),
    getDocs(collection(db, "stories", storyId, "comments")),
  ]);

  const storageRefs = [];
  let authorId = null;

  if (storySnap.exists()) {
    const storyData = storySnap.data();
    authorId = storyData.authorId || null;

    addStorageRef(storageRefs, storyData.coverImage);

    if (Array.isArray(storyData.gallery)) {
      storyData.gallery.forEach((item) => {
        const url = typeof item === "string" ? item : item?.url;
        addStorageRef(storageRefs, url);
      });
    }
  }

  daysSnap.docs.forEach((dayDoc) => {
    addStorageRef(storageRefs, dayDoc.data().imageUrl);
  });

  await Promise.all([
    ...daysSnap.docs.map((dayDoc) => deleteDoc(dayDoc.ref)),
    ...commentsSnap.docs.map((commentDoc) => deleteDoc(commentDoc.ref)),
  ]);

  await Promise.allSettled(storageRefs.map((storageRef) => deleteObject(storageRef)));
  await deleteDoc(storyRef);

  if (authorId) {
    const syncResult = await syncUserGamification(authorId);
    if (!syncResult?.success) {
      console.warn("Gamification sync skipped after story cleanup:", syncResult?.error);
    }
  }
}
