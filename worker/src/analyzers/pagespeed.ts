/**
 * Google PageSpeed Insights API v5 client.
 *
 * Calls the public endpoint with strategy=mobile and requests both
 * the "performance" and "accessibility" categories.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageSpeedResult {
  performanceScore: number; // 0-1
  lcpMs: number;
  clsScore: number;
  fidMs: number; // uses TBT as proxy
  fcpMs: number;
  speedIndex: number;
  ttiMs: number;
  totalBytes: number;
  imageBytes: number;
  scriptBytes: number;
  isResponsive: boolean;
  viewportSet: boolean;
  fontSizeOk: boolean;
  tapTargetsOk: boolean;
  raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** Safely read a numeric value buried inside a Lighthouse audit entry. */
function auditNumeric(
  audits: Record<string, unknown>,
  key: string,
  field: 'numericValue' | 'score' = 'numericValue',
): number {
  const entry = audits[key] as Record<string, unknown> | undefined;
  if (!entry) return 0;
  const val = entry[field];
  return typeof val === 'number' ? val : 0;
}

/** Read a boolean-ish audit (score === 1 means "pass"). */
function auditPasses(audits: Record<string, unknown>, key: string): boolean {
  const entry = audits[key] as Record<string, unknown> | undefined;
  if (!entry) return false;
  return entry['score'] === 1;
}

/** Extract total transfer size from the "resource-summary" audit. */
function extractResourceBytes(
  audits: Record<string, unknown>,
  resourceType: string,
): number {
  const summary = audits['resource-summary'] as Record<string, unknown> | undefined;
  if (!summary) return 0;

  const details = summary['details'] as Record<string, unknown> | undefined;
  if (!details) return 0;

  const items = details['items'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) return 0;

  for (const item of items) {
    if (item['resourceType'] === resourceType) {
      return typeof item['transferSize'] === 'number' ? item['transferSize'] : 0;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runPageSpeed(
  url: string,
  apiKey?: string,
): Promise<PageSpeedResult | null> {
  const params = new URLSearchParams();
  params.set('url', url);
  params.set('strategy', 'mobile');
  params.append('category', 'performance');
  params.append('category', 'accessibility');

  if (apiKey) {
    params.set('key', apiKey);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}?${params.toString()}`);
  } catch (err) {
    console.warn('PageSpeed API fetch failed:', err);
    return null;
  }

  if (!response.ok) {
    console.warn(`PageSpeed API error ${response.status}`);
    return null;
  }

  const data = (await response.json()) as Record<string, unknown>;

  const lighthouse = data['lighthouseResult'] as Record<string, unknown> | undefined;
  if (!lighthouse) {
    throw new Error('PageSpeed response missing lighthouseResult');
  }

  const audits = (lighthouse['audits'] ?? {}) as Record<string, unknown>;
  const categories = (lighthouse['categories'] ?? {}) as Record<string, unknown>;

  // Performance score (0-1)
  const perfCategory = categories['performance'] as Record<string, unknown> | undefined;
  const performanceScore = typeof perfCategory?.['score'] === 'number'
    ? perfCategory['score'] as number
    : 0;

  // Core Web Vitals & speed metrics
  const lcpMs = auditNumeric(audits, 'largest-contentful-paint');
  const clsScore = auditNumeric(audits, 'cumulative-layout-shift');
  const fidMs = auditNumeric(audits, 'total-blocking-time'); // TBT as FID proxy
  const fcpMs = auditNumeric(audits, 'first-contentful-paint');
  const speedIndex = auditNumeric(audits, 'speed-index');
  const ttiMs = auditNumeric(audits, 'interactive');

  // Resource sizes
  const totalBytes = auditNumeric(audits, 'total-byte-weight');
  const imageBytes = extractResourceBytes(audits, 'image');
  const scriptBytes = extractResourceBytes(audits, 'script');

  // Mobile-friendliness signals from accessibility / best-practice audits
  const viewportSet = auditPasses(audits, 'viewport');
  const fontSizeOk = auditPasses(audits, 'font-size');
  const tapTargetsOk = auditPasses(audits, 'tap-targets');

  // "is responsive" is a composite: viewport must be set AND font-size OK
  const isResponsive = viewportSet && fontSizeOk;

  return {
    performanceScore,
    lcpMs,
    clsScore,
    fidMs,
    fcpMs,
    speedIndex,
    ttiMs,
    totalBytes,
    imageBytes,
    scriptBytes,
    isResponsive,
    viewportSet,
    fontSizeOk,
    tapTargetsOk,
    raw: audits,
  };
}
