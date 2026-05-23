import React from "react";
import PublicPageShell from "../components/PublicPageShell";

const highlights = [
  {
    title: "Use With Respect",
    text: "JourneysPage is built for useful travel storytelling, honest experiences, and community-minded publishing.",
  },
  {
    title: "Creator Responsibility",
    text: "Creators are responsible for the stories, images, links, and destination details they submit.",
  },
  {
    title: "Moderated Publishing",
    text: "Submitted stories may be reviewed, returned, approved, hidden, or removed to protect quality and trust.",
  },
];

const sections = [
  {
    title: "Acceptance Of Terms",
    body:
      "By accessing or using JourneysPage, you agree to use the platform responsibly and follow these terms. If you do not agree with these terms, you should not use the service.",
  },
  {
    title: "Accounts And Access",
    body:
      "Some features require an account. You are responsible for keeping your login details secure and for activity that happens through your account. Use accurate profile information where it affects identity, attribution, or moderation.",
    bullets: [
      "Do not share accounts in a way that creates confusion or misuse.",
      "Keep your account email and recovery access current.",
      "Notify the platform owner if you suspect unauthorized access.",
    ],
  },
  {
    title: "User Content",
    body:
      "You keep ownership of the travel stories, photos, captions, and other content you submit. By submitting content, you give JourneysPage permission to display, format, store, moderate, and promote that content inside the platform experience.",
    bullets: [
      "Only upload content you own or have permission to use.",
      "Do not post misleading, unsafe, abusive, illegal, or privacy-invasive content.",
      "Do not include private information about others without permission.",
      "Destination details should be shared honestly and with reasonable care.",
    ],
  },
  {
    title: "Publishing Consent And Copyright",
    body:
      "When you submit a story for review, you must confirm that the story, images, captions, videos, links, and other materials belong to you or are used with permission. JourneysPage may store this confirmation with the story record.",
    bullets: [
      "Do not submit copied text, downloaded images, screenshots, maps, thumbnails, music, or other copyrighted material without permission.",
      "Credit alone does not guarantee that you have permission to publish someone else's work.",
      "If copyright or ownership concerns are found, the content may be removed or restricted.",
      "Repeated or serious violations may lead to publishing limits, suspension, or account deactivation.",
    ],
  },
  {
    title: "Review, Moderation, And Removal",
    body:
      "JourneysPage may review submitted stories before they become public. Content can be returned for changes, approved, unpublished, restricted, or removed if it harms trust, safety, quality, or platform operations.",
  },
  {
    title: "Account Restrictions",
    body:
      "JourneysPage may restrict, suspend, or deactivate accounts that violate these terms, the Community Guidelines, the Copyright Policy, or platform safety expectations. Severe violations may be acted on immediately.",
  },
  {
    title: "Community Features",
    body:
      "Likes, shares, comments, gifts, rankings, badges, and other progression features are intended to encourage positive participation. Attempts to manipulate these systems, spam users, or create fake engagement may lead to restrictions.",
  },
  {
    title: "Platform Availability",
    body:
      "JourneysPage may change, pause, improve, or remove features over time. The service is provided as available, and occasional downtime, maintenance, or feature changes may happen.",
  },
  {
    title: "Liability And Travel Decisions",
    body:
      "Stories on JourneysPage are community and creator-submitted content. Travelers should verify conditions, routes, costs, safety, permits, weather, local rules, and other practical details before making travel decisions.",
  },
  {
    title: "Policy Updates",
    body:
      "These terms may be updated as the product grows. Continued use of JourneysPage after changes means you accept the updated terms. A formal legal review is recommended before a large public launch or commercial rollout.",
  },
];

export default function Terms() {
  return (
    <PublicPageShell
      eyebrow="Terms Of Service"
      title="Clear expectations make better travel communities."
      intro="These terms explain how JourneysPage should be used, what creators are responsible for, and how the platform protects quality through moderation, account access, and responsible publishing."
      highlights={highlights}
      sections={sections}
      asideTitle="Plain-language summary"
      asideText="Use the platform honestly, upload only content you have rights to use, respect other people, and understand that reviewed publishing protects the public discovery experience."
      asidePoints={[
        "Creators own their stories but allow JourneysPage to display them.",
        "Public stories may be moderated for quality and safety.",
        "Content ownership consent is required before publishing.",
        "Travel decisions should be verified independently.",
      ]}
      ctaTitle="Ready to share responsibly?"
      ctaText="Start with a draft, add useful details, and submit your journey for review when it is ready for readers."
      ctaPrimary={{ label: "Create A Story", to: "/register" }}
      ctaSecondary={{ label: "Read Guidelines", to: "/guidelines" }}
    />
  );
}
