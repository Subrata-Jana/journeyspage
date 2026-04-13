import React from "react";
import PublicPageShell from "../components/PublicPageShell";

const highlights = [
  {
    title: "Curated Publishing",
    text: "JourneysPage favors approved, reviewed stories over noisy open posting so discovery feels intentional.",
  },
  {
    title: "Place-Aware Storytelling",
    text: "Trips blend narrative, route context, and destination metadata to make travel writing easier to browse and trust.",
  },
  {
    title: "Community Progression",
    text: "Ranks, badges, and engagement systems reward useful storytelling instead of shallow volume.",
  },
];

const sections = [
  {
    title: "What JourneysPage Is",
    body: [
      "JourneysPage is a travel community built around approved journey stories, not disposable posts. Each story is meant to help readers understand a place, a route, and the experience behind it before they decide to explore further.",
      "The product is designed to feel editorial on the surface and community-powered underneath. Visitors discover visually strong journeys, while creators get a structured space to document routes, highlights, images, and useful context.",
    ],
  },
  {
    title: "How Publishing Works",
    body:
      "Stories move through a moderated workflow. Creators draft, submit, revise when needed, and then publish only after approval. That extra step helps the homepage and discovery surfaces stay high-signal and more trustworthy for readers.",
    bullets: [
      "Drafts stay editable while creators shape the story.",
      "Submitted stories enter a review flow before they go live.",
      "Approved stories become publicly visible discovery content.",
      "Returned stories can be improved and resubmitted.",
    ],
  },
  {
    title: "What Makes The Experience Different",
    body:
      "JourneysPage is built for rich travel stories that combine atmosphere and practicality. Instead of forcing everything into a plain feed card, the platform encourages strong cover imagery, location context, trip structure, and narrative details that are genuinely useful to future travelers.",
    bullets: [
      "Image-first discovery for stronger first impressions.",
      "Story-led planning with real place and trip metadata.",
      "Moderation that protects quality on public surfaces.",
      "Creator progression systems that reward meaningful contribution.",
    ],
  },
];

export default function About() {
  return (
    <PublicPageShell
      eyebrow="About JourneysPage"
      title="A travel platform built for journeys worth following."
      intro="JourneysPage brings together destination-led storytelling, curated publishing, and community progression so travel content feels more trustworthy, more visual, and more useful from the very first glance."
      highlights={highlights}
      sections={sections}
      asideTitle="Best understood as"
      asideText="A blend of editorial travel discovery and creator-led community publishing, shaped around approval, structure, and visual storytelling."
      asidePoints={[
        "Approved stories become the public discovery layer.",
        "Creators keep ownership of their travel narrative.",
        "Readers get cleaner, more useful destination content.",
      ]}
      ctaTitle="See how approved journeys appear live"
      ctaText="Browse the homepage and story pages to see how the publishing workflow turns submitted trips into polished public discovery content."
      ctaPrimary={{ label: "Browse Home", to: "/" }}
      ctaSecondary={{ label: "Create A Story", to: "/register" }}
    />
  );
}
