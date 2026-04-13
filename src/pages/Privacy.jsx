import React from "react";
import PublicPageShell from "../components/PublicPageShell";

const highlights = [
  {
    title: "Purpose-Led Data Use",
    text: "Data should support accounts, publishing, moderation, and community features rather than unnecessary collection.",
  },
  {
    title: "Access Controls",
    text: "Public stories and protected user/account data follow different visibility rules inside the product.",
  },
  {
    title: "Evolving Product",
    text: "Privacy details should be reviewed as features, integrations, and moderation workflows evolve over time.",
  },
];

const sections = [
  {
    title: "What JourneysPage Collects",
    body:
      "JourneysPage collects the information needed to operate user accounts, publish travel stories, support moderation, and power engagement features such as likes, shares, gifts, rankings, and notifications.",
    bullets: [
      "Basic account and profile information.",
      "Story content, images, captions, and destination details you submit.",
      "Platform interaction data tied to publishing and community features.",
    ],
  },
  {
    title: "How That Information Is Used",
    body:
      "Information is used to authenticate users, display profile and story content, review submitted journeys, protect platform quality, and improve the experience for readers and creators.",
    bullets: [
      "To publish and display approved travel stories.",
      "To run moderation and revision workflows.",
      "To support engagement, progression, and notifications.",
      "To improve reliability, safety, and discovery quality.",
    ],
  },
  {
    title: "Visibility And Sharing",
    body:
      "Approved stories are intended to be visible to the public. Account-level details and protected user information should remain limited to authenticated access, administrative workflows, or the parts of the platform where they are required to function.",
  },
  {
    title: "Retention, Controls, And Policy Review",
    body: [
      "JourneysPage should retain information only as long as it is needed for product operations, moderation history, safety, or legitimate service requirements.",
      "This page is a product-facing policy summary and should be reviewed against final legal and compliance requirements before a full public launch.",
    ],
  },
];

export default function Privacy() {
  return (
    <PublicPageShell
      eyebrow="Privacy Policy"
      title="Privacy should stay practical, transparent, and proportionate."
      intro="JourneysPage is designed around account access, approved publishing, and community participation. That means privacy should focus on the data needed to run those flows well while limiting unnecessary exposure."
      highlights={highlights}
      sections={sections}
      asideTitle="Policy summary"
      asideText="Public discovery content and private user/account data should be treated differently. Stories are meant to be read. Sensitive account details are not."
      asidePoints={[
        "Approved stories can be public-facing.",
        "Protected account data should remain access-controlled.",
        "Legal review is recommended before final launch.",
      ]}
      ctaTitle="Review how stories appear publicly"
      ctaText="Use the homepage and story pages to validate what is intentionally public, then compare it against the privacy expectations you want for launch."
      ctaPrimary={{ label: "Browse Home", to: "/" }}
      ctaSecondary={{ label: "Read Terms", to: "/terms" }}
    />
  );
}
