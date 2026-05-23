const AUTHORIZED_ADMIN_EMAILS = ["sjsubratajana@gmail.com"];
export const USER_ROLES = {
  ADMIN: "admin",
  EDITOR: "editor",
  USER: "user",
};

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

export function isAuthorizedAdminEmail(email) {
  return AUTHORIZED_ADMIN_EMAILS.includes(normalizeEmail(email));
}

export function isAuthorizedAdmin(userOrEmail, profile = null) {
  const email =
    typeof userOrEmail === "string" ? userOrEmail : userOrEmail?.email;

  return profile?.role === USER_ROLES.ADMIN || isAuthorizedAdminEmail(email);
}

export function isAuthorizedEditor(profile = null) {
  return profile?.role === USER_ROLES.EDITOR;
}

export function isReviewStaff(userOrEmail, profile = null) {
  return isAuthorizedAdmin(userOrEmail, profile) || isAuthorizedEditor(profile);
}

export function canReviewStoryAsStaff(user, profile, story) {
  if (!user || !story) return false;
  if (isAuthorizedAdmin(user, profile)) return true;
  return (
    isAuthorizedEditor(profile) &&
    story.status === "pending" &&
    story.authorId !== user.uid
  );
}

export { AUTHORIZED_ADMIN_EMAILS };
