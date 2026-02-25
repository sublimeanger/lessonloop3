import { useEffect } from "react";

interface OpenGraphOptions {
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogUrl?: string;
  ogImage?: string;
  ogLocale?: string;
  ogSiteName?: string;
  twitterCard?: string;
  canonical?: string;
  robots?: string;
}

const DEFAULT_TITLE = "LessonLoop — Music School Management Software for UK Academies";
const DEFAULT_DESCRIPTION =
  "Schedule lessons, automate invoicing, track attendance, and keep parents in the loop. Music school management software built for UK educators. Free 30-day trial.";

function upsertMeta(attr: string, value: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (attr === "property") el.setAttribute("property", value);
    else el.setAttribute("name", value);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  return el;
}

export function usePageMeta(title: string, description: string, og?: OpenGraphOptions) {
  useEffect(() => {
    document.title = title;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute("content", description);

    // OG & Twitter tags
    const ogEls: HTMLMetaElement[] = [];
    if (og?.ogTitle) ogEls.push(upsertMeta("property", "og:title", og.ogTitle));
    if (og?.ogDescription) ogEls.push(upsertMeta("property", "og:description", og.ogDescription));
    if (og?.ogType) ogEls.push(upsertMeta("property", "og:type", og.ogType));
    if (og?.ogUrl) ogEls.push(upsertMeta("property", "og:url", og.ogUrl));
    if (og?.ogImage) ogEls.push(upsertMeta("property", "og:image", og.ogImage));
    if (og?.ogLocale) ogEls.push(upsertMeta("property", "og:locale", og.ogLocale));
    if (og?.ogSiteName) ogEls.push(upsertMeta("property", "og:site_name", og.ogSiteName));
    if (og?.twitterCard) ogEls.push(upsertMeta("name", "twitter:card", og.twitterCard));

    // Canonical
    let canonicalEl: HTMLLinkElement | null = null;
    if (og?.canonical) canonicalEl = upsertLink("canonical", og.canonical);

    // Robots
    let robotsEl: HTMLMetaElement | null = null;
    if (og?.robots) robotsEl = upsertMeta("name", "robots", og.robots);

    return () => {
      document.title = DEFAULT_TITLE;
      if (descMeta) descMeta.setAttribute("content", DEFAULT_DESCRIPTION);
    };
  }, [title, description, og]);
}
