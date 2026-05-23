# JourneysPage Web

JourneysPage is a React/Vite/Firebase travel storytelling platform. It supports public discovery of approved journeys, authenticated creator workflows, admin review, profiles, comments, notifications, gamification, image uploads, and Firebase-hosted production deployment.

Live Firebase Hosting URL:

https://journeyspage-c558b.web.app

When a custom domain is connected, replace this URL in `index.html`, `src/components/Seo.jsx`, `public/robots.txt`, and `public/sitemap.xml`.

## Quick Start

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Deploy current production target:

```bash
npm run build
firebase deploy --project journeyspage-c558b --only "hosting,firestore:rules,storage"
```

## Main Stack

- React 18 + Vite
- Firebase Auth
- Cloud Firestore
- Firebase Storage
- Firebase Hosting
- Tailwind CSS v4
- Framer Motion
- Lucide React icons

## Important Project Files

- `src/App.jsx`: route map and layout rules.
- `src/pages/Home.jsx`: public landing/discovery page.
- `src/pages/CreateStory.jsx`: story draft, edit, upload, and submit flow.
- `src/pages/StoryDetail.jsx`: public story view plus admin review overlays.
- `src/pages/AdminPanel.jsx`: moderation/admin tooling.
- `src/pages/Profile.jsx`: profile, wallet, showcase, and profile media.
- `src/pages/Terms.jsx`: public terms of service page.
- `src/contexts/AuthContext.jsx`: auth/session/profile bootstrap.
- `src/services/firebase.js`: Firebase client initialization.
- `src/services/reviewService.js`: approve/return story review actions.
- `src/services/gamificationService.js`: likes, tracking, shares, gifts, XP, badges.
- `firestore.rules`: Firestore security rules.
- `storage.rules`: Firebase Storage security rules.
- `firebase.json`: Hosting target, rewrites, headers, and deploy config.
- `index.html` and `src/components/Seo.jsx`: SEO shell and route-aware metadata.
- `public/robots.txt` and `public/sitemap.xml`: crawl files.
- `AGENTS.md`: concise handoff instructions for AI coding agents.

## Production Notes

Firebase Hosting serves `dist`, not `public`. Always run `npm run build` before deploying hosting.

The current production deploy includes:

- SPA rewrite to `/index.html`
- Security headers
- Immutable cache headers for JS/CSS assets
- No-cache header for `index.html`
- Firestore rules with protected admin role updates
- Storage rules with owner checks and upload size limits

## Current Known Technical Debt

- Main JS bundle is large, around 2 MB minified and about 488 KB gzip. Code splitting admin/dashboard/create/story routes is the best next performance improvement.
- Lint passes, but there are cleanup warnings for unused variables and some hook dependency warnings.
- Some gamification writes still happen client-side. Longer term, move XP, gifts, likes, shares, and badge/rank calculations into Cloud Functions for stronger integrity.
- SEO is good for static crawl basics, but individual story social previews are client-rendered. Server-side dynamic meta or prerendering would improve social sharing.

## Safe Pre-Deploy Checklist

1. Run `npm run build`.
2. Run `npm run lint`.
3. Run `npm audit --audit-level=moderate` in the root project.
4. Run `npm audit --audit-level=moderate` inside `functions`.
5. Smoke test login, register, create story, upload image, submit story, admin approve, public story page, profile edit, comments, likes, shares, and gifts.
6. Deploy with the Firebase command above.
