import React from "react";
import PublicPageShell from "../components/PublicPageShell";

const highlights = [
  {
    title: "Own Or Licensed",
    text: "Publish only stories, photos, captions, video links, and other materials you created or have permission to use.",
  },
  {
    title: "Helpful And Honest",
    text: "Travel stories should be truthful, practical, respectful, and useful for readers planning or discovering a place.",
  },
  {
    title: "Moderated For Trust",
    text: "Stories may be returned, hidden, removed, or escalated if they violate safety, copyright, privacy, or quality rules.",
  },
];

const sections = [
  {
    title: "Creator Responsibility",
    body:
      "Every creator is responsible for the text, images, captions, routes, cost details, videos, links, and comments they submit. Before publishing, make sure your content is accurate, respectful, and lawful.",
    bullets: [
      "Use your own photos and writing whenever possible.",
      "If someone else helped create the content, get permission before publishing.",
      "Keep travel facts honest. Do not invent costs, safety information, permits, or route conditions.",
      "Remove private details such as phone numbers, addresses, IDs, tickets, or faces of people who did not consent.",
    ],
  },
  {
    title: "Do",
    body:
      "JourneysPage works best when creators share original travel experience with enough context for readers to understand the place and make safer decisions.",
    bullets: [
      "Write in your own voice and describe what you personally experienced.",
      "Credit collaborators where credit is appropriate.",
      "Use clear captions for images, galleries, and 360-degree photos.",
      "Mention known risks, restrictions, permits, seasonal issues, or accessibility concerns when relevant.",
      "Keep Bengali, English, or multilingual text readable and respectful.",
    ],
  },
  {
    title: "Do Not",
    body:
      "Content that harms people, misleads readers, violates rights, or damages trust may be rejected, removed, or used as a reason to restrict the account.",
    bullets: [
      "Do not upload copyrighted photos, copied blog text, maps, music, videos, artwork, screenshots, or commercial material without permission.",
      "Do not post hateful, abusive, sexually explicit, exploitative, threatening, or harassing content.",
      "Do not reveal private personal information or location-sensitive information that could put someone at risk.",
      "Do not promote scams, illegal activity, dangerous stunts, vandalism, trespassing, or wildlife disturbance.",
      "Do not manipulate likes, views, gifts, ranks, comments, or review workflows.",
    ],
  },
  {
    title: "Image And Media Rules",
    body:
      "Images are a core part of JourneysPage. They must be safe to show publicly and must not infringe another creator's rights.",
    bullets: [
      "Upload photos you took yourself, commissioned, licensed, or have written permission to use.",
      "Do not upload images from Google, Instagram, Facebook, YouTube thumbnails, travel sites, stock libraries, or news outlets unless your license permits this exact use.",
      "Do not remove watermarks, crop credits, or alter images to hide ownership.",
      "Avoid showing minors, private homes, documents, number plates, or identifiable strangers without appropriate consent.",
    ],
  },
  {
    title: "Review And Enforcement",
    body:
      "Moderation decisions are made to protect the platform, readers, creators, and rights holders. Depending on severity and history, JourneysPage may take one or more actions.",
    bullets: [
      "Return a story for correction before publication.",
      "Reject, unpublish, or delete a story or media item.",
      "Limit publishing access or review future stories more strictly.",
      "Suspend, restrict, or deactivate accounts for serious or repeated violations.",
      "Preserve moderation records where needed for safety, legal, or operational reasons.",
    ],
  },
  {
    title: "Important Note",
    body:
      "These guidelines are product rules, not legal advice. They should be reviewed by a qualified professional before a large public or commercial launch, especially if JourneysPage receives formal legal notices or operates across multiple jurisdictions.",
  },
];

export default function CommunityGuidelines() {
  return (
    <PublicPageShell
      eyebrow="Community Guidelines"
      title="Publish travel stories people can trust."
      intro="These guidelines explain what creators may publish, what must be avoided, and how JourneysPage protects the platform from copyright, safety, privacy, and quality violations."
      highlights={highlights}
      sections={sections}
      asideTitle="Before You Submit"
      asideText="If you cannot confidently say you created the content or have permission to publish it, do not submit it for review."
      asidePoints={[
        "Original travel writing is safest.",
        "Own or license every uploaded image.",
        "Respect people, places, privacy, and local rules.",
      ]}
      ctaTitle="Ready to publish responsibly?"
      ctaText="Create a draft, check the story against these rules, then accept the creator consent before submitting for review."
      ctaPrimary={{ label: "Create A Story", to: "/create-story" }}
      ctaSecondary={{ label: "Read Copyright Policy", to: "/copyright" }}
    />
  );
}
