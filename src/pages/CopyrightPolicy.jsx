import React from "react";
import PublicPageShell from "../components/PublicPageShell";

const highlights = [
  {
    title: "Original Works",
    text: "Copyright commonly protects original creative works such as writing, photographs, artwork, video, music, and software.",
  },
  {
    title: "Permission Required",
    text: "Creators should upload only material they own, created themselves, or have a valid license or permission to publish.",
  },
  {
    title: "Removal Process",
    text: "JourneysPage may remove or restrict content when copyright concerns are reported or discovered during review.",
  },
];

const sections = [
  {
    title: "Copyright Policy",
    body:
      "JourneysPage respects creators, photographers, writers, and rights holders. Users must not upload or publish material that infringes copyright, trademark, privacy, publicity, or other rights.",
    bullets: [
      "Do not copy travel blogs, guidebooks, articles, social posts, captions, itineraries, maps, or media created by others.",
      "Do not upload photos from search engines, social media, stock sites, news sites, tourism boards, or other travel platforms unless your license allows this use.",
      "Do not use music, video clips, thumbnails, logos, or artwork without permission.",
      "Do not assume that credit alone makes copyrighted material safe to use.",
    ],
  },
  {
    title: "Creator Consent At Submission",
    body:
      "When submitting a story for review, the creator must confirm that the submitted story and media belong to them or are used with permission. This confirmation is stored with the story record for moderation and platform safety.",
  },
  {
    title: "Reporting Copyright Concerns",
    body:
      "If you believe a story or media item on JourneysPage infringes your rights, contact the platform owner with enough information to identify the material and your claim. A complete notice helps the platform review and act quickly.",
    bullets: [
      "Your name and contact email.",
      "A link to the JourneysPage story or specific material you are reporting.",
      "Identification of the copyrighted work or rights you claim are infringed.",
      "A statement that you believe the disputed use is not authorized by the owner, agent, or law.",
      "A statement that the information you provide is accurate and that you are the rights owner or authorized to act for the owner.",
    ],
  },
  {
    title: "Platform Response",
    body:
      "JourneysPage may remove, hide, restrict, or disable access to reported content while reviewing a claim. Repeated or serious violations may lead to account restrictions, publishing limits, or account deactivation.",
  },
  {
    title: "Counter-Information",
    body:
      "If a creator believes their removed content was original, licensed, or otherwise allowed, they may contact the platform with supporting information such as ownership details, license records, permission emails, or proof of original creation.",
  },
  {
    title: "Operational And Legal Notes",
    body: [
      "This policy is a platform operating policy and is not legal advice.",
      "Before relying on formal DMCA safe-harbor processes in the United States, an online service provider should review U.S. Copyright Office guidance and consider registering a designated agent.",
      "For launch, commercial operation, or repeated copyright claims, JourneysPage should obtain legal review of its Terms, Copyright Policy, moderation workflow, and notice handling process.",
    ],
  },
  {
    title: "Helpful Official References",
    body:
      "The following official resources explain copyright basics and notice-and-takedown concepts. They are included for creator education and platform planning.",
    bullets: [
      "U.S. Copyright Office: https://www.copyright.gov/help/faq/faq-protect.html",
      "USPTO Copyright Basics: https://www.uspto.gov/ip-policy/copyright-policy/copyright-basics",
      "U.S. Copyright Office Section 512 Resources: https://www.copyright.gov/512/index.html",
      "U.S. Copyright Office Fair Use FAQ: https://www.copyright.gov/help/faq/faq-fairuse.html",
    ],
  },
];

export default function CopyrightPolicy() {
  return (
    <PublicPageShell
      eyebrow="Copyright Policy"
      title="Respect original creators and publish only what you can use."
      intro="This policy explains creator responsibilities, reporting options, and platform actions for copyright or ownership concerns on JourneysPage."
      highlights={highlights}
      sections={sections}
      asideTitle="Simple Rule"
      asideText="If you did not create it and do not have permission, do not upload it."
      asidePoints={[
        "Credit is good, but permission is what matters.",
        "Licenses should cover public platform use.",
        "Violations may lead to removal or account action.",
      ]}
      ctaTitle="Unsure about a media item?"
      ctaText="Leave it out of the story until you can confirm ownership, license, or permission."
      ctaPrimary={{ label: "Read Guidelines", to: "/guidelines" }}
      ctaSecondary={{ label: "Contact Support", to: "/contact" }}
    />
  );
}
