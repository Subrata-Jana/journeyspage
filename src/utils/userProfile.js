export function getProfilePhotoUrl(profile) {
  if (!profile) return "";

  return (
    profile.photoURL ||
    profile.avatarUrl ||
    profile.profilePhoto ||
    profile.avatar ||
    ""
  );
}

export function normalizeUserProfile(profile) {
  if (!profile) return profile;

  const photoURL = getProfilePhotoUrl(profile);

  return {
    ...profile,
    photoURL,
    avatarUrl: profile.avatarUrl || photoURL,
  };
}

export function buildAvatarFields(url = "") {
  return {
    photoURL: url,
    avatarUrl: url,
  };
}
