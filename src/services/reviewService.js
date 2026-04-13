import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { syncUserGamification } from "./gamificationService";
import { sendNotification } from "./notificationService";

export const normalizeFeedbackMap = (feedback = {}) =>
  Object.fromEntries(
    Object.entries(feedback).filter(
      ([, value]) => typeof value === "string" && value.trim() !== ""
    )
  );

export const buildReviewReturnData = ({
  existingFeedback = {},
  generalNote = "",
} = {}) => {
  const cleanedFeedback = normalizeFeedbackMap(existingFeedback);
  const note = generalNote.trim();

  if (note) cleanedFeedback.general = note;

  const summary =
    note ||
    cleanedFeedback.general ||
    "Please review the flagged items and resubmit.";

  return {
    feedback: cleanedFeedback,
    summary,
    payload: {
      status: "returned",
      published: false,
      adminNotes: summary,
      feedback: cleanedFeedback,
      updatedAt: serverTimestamp(),
    },
  };
};

export const buildApprovalPayload = () => ({
  status: "approved",
  published: true,
  feedback: {},
  adminNotes: "",
  updatedAt: serverTimestamp(),
});

export async function notifyStorySubmittedForReview({
  storyId,
  title,
  authorId,
  authorName,
  isResubmission = false,
}) {
  await sendNotification({
    recipientId: "admin",
    type: "info",
    title: isResubmission ? "Story Resubmitted" : "Story Submitted",
    message: `${authorName || "An author"} submitted "${title}" for review.`,
    link: `/story/${storyId}?adminView=true`,
    actorId: authorId,
    actorName: authorName || "Author",
    entityType: "story",
    entityId: storyId,
    channel: "review",
    meta: { isResubmission },
  });
}

export async function returnStoryForRevision({
  storyId,
  authorId,
  title,
  existingFeedback = {},
  generalNote = "",
}) {
  const { payload, feedback, summary } = buildReviewReturnData({
    existingFeedback,
    generalNote,
  });

  await updateDoc(doc(db, "stories", storyId), payload);

  if (authorId) {
    await sendNotification({
      recipientId: authorId,
      type: "warning",
      title: "Story Returned For Changes",
      message: `"${title}" needs updates. ${summary}`,
      link: `/create-story?edit=${storyId}`,
      entityType: "story",
      entityId: storyId,
      channel: "review",
      meta: {
        reviewStatus: "returned",
        feedbackCount: Object.keys(feedback).length,
      },
    });
  }

  return { payload, feedback, summary };
}

export async function approveStoryReview({ storyId, authorId, title }) {
  const payload = buildApprovalPayload();
  await updateDoc(doc(db, "stories", storyId), payload);
  if (authorId) {
    const syncResult = await syncUserGamification(authorId);
    if (!syncResult?.success) {
      console.warn("Gamification sync skipped after approval:", syncResult?.error);
    }
  }

  if (authorId) {
    await sendNotification({
      recipientId: authorId,
      type: "success",
      title: "Story Approved",
      message: `"${title}" is now live on Journeys Page.`,
      link: `/story/${storyId}`,
      entityType: "story",
      entityId: storyId,
      channel: "review",
      meta: { reviewStatus: "approved" },
    });
  }

  return payload;
}
