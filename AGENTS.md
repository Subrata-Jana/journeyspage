# Agent Handoff For JourneysPage

Use this file first. It exists to save analysis time and reduce token/credit usage for future agentic AI work.

## Project Summary

This is a production Firebase-hosted React/Vite app for a travel storytelling platform called JourneysPage.

Live URL:

https://journeyspage-c558b.web.app

Firebase project:

`journeyspage-c558b`

Primary app behavior:

- Public users browse approved travel stories.
- Authenticated users create, edit, and submit journey stories.
- Admin reviews stories and approves or returns them.
- Profiles include images, social links, gamification wallet/showcase, stats.
- Stories include cover images, gallery images, optional 360 images, days, comments, likes, shares, gifts, and tracking.

## Read These Files First

For most tasks, read only this set before touching code:

1. `src/App.jsx`
2. The specific page/component related to the task.
3. Any matching service under `src/services`.
4. `firestore.rules` or `storage.rules` only if the task touches data access or uploads.
5. `firebase.json` only if the task touches deployment, hosting, routing, headers, or caching.

Avoid scanning `node_modules`, `dist`, debug logs, and generated build output.

## Routing Map

Public routes:

- `/`: `Home`
- `/about`: `About`
- `/contact`: `Contact`
- `/privacy`: `Privacy`
- `/terms`: `Terms`
- `/login`: `Login`
- `/register`: `Register`
- `/forgot-password`: `ForgotPassword`
- `/story/:storyId`: `StoryDetail`

Protected routes:

- `/dashboard`: `Dashboard`
- `/create-story`: `CreateStory`
- `/profile`: own profile
- `/profile/:userId`: other profile
- `/admin`: protected by `ProtectedRoute` and `AdminGuard`

## Deployment

Hosting serves `dist`.

Build:

```bash
npm run build
```

Deploy hosting and rules:

```bash
firebase deploy --project journeyspage-c558b --only "hosting,firestore:rules,storage"
```

Do not change `firebase.json` back to `public`. Vite builds into `dist`.

## Custom Domain Replacement

The temporary production URL appears in:

- `index.html`
- `src/components/Seo.jsx`
- `public/robots.txt`
- `public/sitemap.xml`

When a custom domain is ready, replace `https://journeyspage-c558b.web.app` in those files, then rebuild and redeploy.

## Security Notes

Important current safeguards:

- Users cannot update their own `role` field in Firestore rules.
- Storage story uploads require the uploader to be the story author or admin.
- Storage image uploads have size limits.
- Hosting has security headers in `firebase.json`.

Important future hardening:

- Move XP, inventory, trophies, gifts, likes, shares, and rank/badge calculations to Cloud Functions.
- Avoid widening Firestore rules for convenience. If a client write fails, inspect the exact field diff before changing rules.
- Admin authority is currently based on the allowlisted email and/or user document role. Be careful with role changes.

## SEO Notes

Current SEO basics:

- Base meta tags in `index.html`.
- Route-aware title/description/canonical updates in `src/components/Seo.jsx`.
- Static `robots.txt` and `sitemap.xml`.

Limitations:

- Individual story metadata is client-rendered. Link previews for individual stories may not be ideal until prerendering or server-generated meta is added.
- Sitemap currently lists static public pages only.

## Known Warnings And Technical Debt

- `npm run build` passes but warns about a large JS chunk. Best fix: route-level lazy loading for admin, dashboard, create story, story detail, and heavy media/gamification components.
- `npm run lint` passes with warnings. Most are unused variables, empty catch blocks, or hook dependency warnings.
- Dependencies have newer major versions available, but do not upgrade React/Firebase/router/Vite casually. Treat major upgrades as a separate tested task.

## Safe Change Rules

- Preserve current user flows unless explicitly asked to redesign.
- Prefer small, scoped changes.
- Do not edit generated `dist` manually.
- Do not commit `.env.local` contents into documentation or code.
- Do not run destructive git commands.
- After code changes, run at least:

```bash
npm run build
```

For production/rules changes, also run:

```bash
npm run lint
npm audit --audit-level=moderate
```

## Best Next Improvements

1. Add route-level code splitting.
2. Add dynamic sitemap entries for approved stories.
3. Move gamification integrity writes to Cloud Functions.
4. Add automated smoke tests for auth, story submit, admin approve, and public story read.
5. Replace Firebase web.app URL with custom domain after domain setup.
