/**
 * Fetches a URL and parses the HTML with regex to extract grading signals.
 *
 * No DOM parser is used because this runs inside a Cloudflare Worker
 * where `document` / `DOMParser` are not available.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedPage {
  html: string;
  url: string;
  finalUrl: string;
  isHttps: boolean;
  statusCode: number;

  // SEO / meta
  title: string;
  metaDescription: string;
  h1: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;

  // Conversion signals
  phoneNumbers: string[];
  hasClickToCall: boolean;
  formCount: number;
  hasCtaAboveFold: boolean;
  ctaCount: number;
  navLinkCount: number;

  // Trust signals
  hasTestimonials: boolean;
  hasReviews: boolean;
  hasLicense: boolean;
  hasAboutPage: boolean;

  // Visual signals
  hasRealPhotos: boolean;
  imageCount: number;

  // Mobile signals from HTML (fallback when PageSpeed can't render)
  hasViewportMeta: boolean;
  hasResponsiveCSS: boolean;

  // Schema / local SEO
  hasSchema: boolean;
  hasLocalSchema: boolean;
  mentionsLocation: boolean;
  mentionsService: boolean;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

const CTA_RE =
  /\b(call|contact|quote|estimate|free|schedule|book|get started|request|consultation)\b/i;

const TRUST_RE =
  /\b(testimonials?|reviews?|customer said|what our|clients say|rated|stars?|hear from|feedback)\b/i;

const LICENSE_RE =
  /\b(licen[sc]ed|insured|bonded|certified|accredited)\b/i;

const LOCATION_RE =
  /\b(FL|Florida|Naples|Fort Myers|Cape Coral|Sarasota|Tampa|Bonita Springs|Estero|Lehigh|Marco Island|\d{5})\b/i;

const STOCK_IMG_RE =
  /(unsplash|pexels|shutterstock|istockphoto|gettyimages|stock|placeholder)/i;

const SERVICE_RE =
  /\b(pool|hvac|air condition|roofing|roof|plumb|electric|landscap|paint|remodel|construct)/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip all HTML tags to get raw text content. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

/** Extract the first match's captured group (or the full match). */
function firstMatch(html: string, re: RegExp, group = 1): string {
  const m = re.exec(html);
  return m ? (m[group] ?? m[0]).trim() : '';
}

/** Count non-overlapping matches of a global regex. */
function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/** Extract all image src URLs from <img> tags. */
function extractImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    srcs.push(m[1]);
  }
  return srcs;
}

/**
 * Count <a> tags inside <nav> or <header> blocks.
 *
 * Because we don't have a real DOM parser we use a simple approach:
 * find each <nav>...</nav> and <header>...</header> section, then
 * count <a> occurrences within those sections.
 */
function countNavLinks(html: string): number {
  let count = 0;
  // Match both <nav> and <header> blocks (non-greedy, case-insensitive)
  const blockRe = /<(nav|header)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(html)) !== null) {
    const inner = block[2];
    const links = inner.match(/<a\b/gi);
    count += links ? links.length : 0;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function fetchAndParse(url: string): Promise<ParsedPage> {
  // Normalise the URL
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'SiteGrader/1.0 (+https://sitegrader.app) Mozilla/5.0 (compatible)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const html = await response.text();
  const finalUrl = response.url;
  const isHttps = finalUrl.startsWith('https://');
  const statusCode = response.status;

  // --- SEO / meta -----------------------------------------------------------

  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = firstMatch(
    html,
    /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["']/i,
  ) || firstMatch(
    html,
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']description["']/i,
  );
  const h1 = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitle = firstMatch(
    html,
    /<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["']([^"']*)["']/i,
  ) || firstMatch(
    html,
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bproperty=["']og:title["']/i,
  );
  const ogDescription = firstMatch(
    html,
    /<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["']([^"']*)["']/i,
  ) || firstMatch(
    html,
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bproperty=["']og:description["']/i,
  );
  const ogImage = firstMatch(
    html,
    /<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"']*)["']/i,
  ) || firstMatch(
    html,
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bproperty=["']og:image["']/i,
  );

  // --- Conversion signals ---------------------------------------------------

  const phoneNumbers = [...new Set(html.match(PHONE_RE) ?? [])];

  // Click-to-call: <a href="tel:...">
  const hasClickToCall = /<a\b[^>]*\bhref=["']tel:/i.test(html);

  // Forms
  const formCount = countMatches(html, /<form\b/gi);

  // CTA detection
  const textContent = stripTags(html);
  const ctaCount = countMatches(textContent, new RegExp(CTA_RE.source, 'gi'));
  // Strip tags from body first, THEN slice — bloated HTML (GoDaddy, Wix) has
  // thousands of chars of CSS classes before any visible text.
  const bodyStart = html.search(/<body[\s>]/i);
  const bodyHtml = bodyStart >= 0 ? html.slice(bodyStart) : html;
  const bodyNoStyleScript = bodyHtml
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  const bodyText = stripTags(bodyNoStyleScript).replace(/\s+/g, ' ').trim();
  const aboveFoldText = bodyText.slice(0, 1500);
  const hasCtaAboveFold = CTA_RE.test(aboveFoldText);

  // Navigation links
  const navLinkCount = countNavLinks(html);

  // --- Trust signals --------------------------------------------------------

  const lowerHtml = html.toLowerCase();
  const hasTestimonials = TRUST_RE.test(textContent);
  const hasReviews =
    /\breview/i.test(textContent) ||
    /google.*review|yelp|bbb|angi|homeadvisor/i.test(html);
  const hasLicense = LICENSE_RE.test(textContent);
  const hasAboutPage = /href=["'][^"']*about/i.test(lowerHtml);

  // --- Visual signals -------------------------------------------------------

  const imgSrcs = extractImageSrcs(html);
  const imageCount = imgSrcs.length;

  // "Real photos" = at least one image that does NOT come from a stock domain
  const hasRealPhotos =
    imageCount > 0 && imgSrcs.some((src) => !STOCK_IMG_RE.test(src));

  // --- Schema / local SEO ---------------------------------------------------

  const hasSchema =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html);
  const hasLocalSchema =
    hasSchema && /LocalBusiness|HomeAndConstructionBusiness|Plumber|RoofingContractor|HVACBusiness/i.test(html);

  const mentionsLocation = LOCATION_RE.test(textContent);
  const mentionsService = SERVICE_RE.test(textContent);

  // --- Mobile signals from HTML (fallback for slow-rendering pages) ---------

  const hasViewportMeta =
    /name=["']viewport["']/i.test(html);
  const hasResponsiveCSS =
    /@media[^{]*max-width/i.test(html) || /@media[^{]*min-width/i.test(html);

  return {
    html,
    url,
    finalUrl,
    isHttps,
    statusCode,
    title,
    metaDescription,
    h1,
    ogTitle,
    ogDescription,
    ogImage,
    phoneNumbers,
    hasClickToCall,
    formCount,
    hasCtaAboveFold,
    ctaCount,
    navLinkCount,
    hasTestimonials,
    hasReviews,
    hasLicense,
    hasAboutPage,
    hasRealPhotos,
    imageCount,
    hasViewportMeta,
    hasResponsiveCSS,
    hasSchema,
    hasLocalSchema,
    mentionsLocation,
    mentionsService,
  };
}
