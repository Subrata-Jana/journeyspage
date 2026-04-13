import React from "react";
import PublicPageShell from "../components/PublicPageShell";

const highlights = [
  {
    title: "Support First",
    text: "The fastest path is usually the workflow already built into your account, story draft, or moderation flow.",
  },
  {
    title: "Clear Routing",
    text: "Account issues, story review questions, and platform concerns are easier to resolve when sent through the right path.",
  },
  {
    title: "Context Helps",
    text: "A story link, screenshot, and short summary dramatically improve response quality and speed.",
  },
];

const sections = [
  {
    title: "Account And Profile Help",
    body:
      "Most account-related tasks should be handled directly inside the product first. Profile updates, story management, and personal settings are all intended to stay self-serve where possible.",
    bullets: [
      "Update profile information from your account area.",
      "Manage story drafts and submitted journeys from the dashboard.",
      "Use password recovery when you are locked out of your account.",
    ],
  },
  {
    title: "Story Review And Publishing Questions",
    body:
      "Questions about why a story was returned, what needs to change, or how approval works should stay connected to the story review workflow itself. That keeps moderation context attached to the content being discussed.",
    bullets: [
      "Use the draft and revision flow for returned stories.",
      "Review admin notes carefully before resubmitting.",
      "Keep story-specific feedback attached to the story, not separate channels.",
    ],
  },
  {
    title: "Trust, Safety, And Platform Concerns",
    body:
      "If something on the platform looks unsafe, misleading, abusive, or technically broken, report it with enough context for the team to reproduce and review the issue quickly.",
    bullets: [
      "Include the story URL or exact page path.",
      "Add screenshots when the issue is visual or device-specific.",
      "Describe what you expected to happen and what actually happened.",
    ],
  },
];

export default function Contact() {
  return (
    <PublicPageShell
      eyebrow="Contact And Support"
      title="The right route makes support faster."
      intro="JourneysPage works best when support stays tied to the part of the product where the issue actually happened. Use account tools for account tasks, story workflows for publishing questions, and clear reports for trust or technical issues."
      highlights={highlights}
      sections={sections}
      asideTitle="Best current approach"
      asideText="JourneysPage is optimized around in-product workflows first. That means story and account issues are usually easiest to resolve from the dashboard, profile, or review flow itself."
      asidePoints={[
        "Keep the relevant story link ready.",
        "Attach screenshots for UI or rendering issues.",
        "Summarize the problem in one or two clear sentences.",
      ]}
      ctaTitle="Go where the issue actually lives"
      ctaText="Use the dashboard for story management, the profile area for account changes, and the public homepage for discovery and reading."
      ctaPrimary={{ label: "Open Home", to: "/" }}
      ctaSecondary={{ label: "Join JourneysPage", to: "/register" }}
    />
  );
}
