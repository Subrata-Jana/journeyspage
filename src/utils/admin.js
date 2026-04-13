const AUTHORIZED_ADMIN_EMAILS = ["sjsubratajana@gmail.com"];

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

export function isAuthorizedAdminEmail(email) {
  return AUTHORIZED_ADMIN_EMAILS.includes(normalizeEmail(email));
}

export function isAuthorizedAdmin(userOrEmail, profile = null) {
  const email =
    typeof userOrEmail === "string" ? userOrEmail : userOrEmail?.email;

  return profile?.role === "admin" || isAuthorizedAdminEmail(email);
}

export { AUTHORIZED_ADMIN_EMAILS };
