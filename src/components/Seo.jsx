import { useEffect } from "react";

const SITE_URL = "https://journeyspage-c558b.web.app";
const DEFAULT_DESCRIPTION =
  "A curated travel storytelling community for discovering approved journeys and publishing structured trip stories.";

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    const nameMatch = selector.match(/meta\[name="([^"]+)"\]/);
    const propertyMatch = selector.match(/meta\[property="([^"]+)"\]/);

    if (nameMatch) element.setAttribute("name", nameMatch[1]);
    if (propertyMatch) element.setAttribute("property", propertyMatch[1]);
    document.head.appendChild(element);
  }

  element.setAttribute(attribute, value);
}

export default function Seo({
  title = "JourneysPage",
  description = DEFAULT_DESCRIPTION,
  path = "/",
}) {
  useEffect(() => {
    const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
    const canonicalUrl = `${SITE_URL}${normalizedPath}`;
    document.title = title;

    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonicalUrl);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);
  }, [title, description, path]);

  return null;
}
