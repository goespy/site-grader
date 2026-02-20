/**
 * Ad Landing Readiness Analyzer (weight: 10% of overall score).
 *
 * Evaluates whether the site is ready to convert paid traffic — does it
 * mention the service, the area, load fast enough for ad clicks, and
 * stay focused without distracting visitors?
 */

import type { ParsedPage } from './fetch-page.js';
import type { PageSpeedResult } from './pagespeed.js';
import { type CategoryResult, type Finding, calculateCategoryScore } from './types.js';

export function analyzeAdReadiness(
  page: ParsedPage,
  speed: PageSpeedResult | null,
  businessType: string,
): CategoryResult {
  const findings: Finding[] = [];

  // 1. Service mentioned above the fold (high impact)
  findings.push({
    label: 'Service mentioned above the fold',
    pass: page.mentionsService,
    detail: page.mentionsService
      ? `Your site mentions your service right away. When someone clicks an ad for "${businessType.toLowerCase()}," they immediately see that they're in the right place.`
      : `We didn't find your service mentioned prominently on the page. When someone clicks an ad for "${businessType.toLowerCase()}" and doesn't immediately see that word on your site, they hit the back button. Make sure your headline says exactly what you do.`,
    impact: 'high',
  });

  // 2. Service area mentioned (high impact)
  findings.push({
    label: 'Service area mentioned',
    pass: page.mentionsLocation,
    detail: page.mentionsLocation
      ? 'Your site mentions your service area. Customers who click a local ad want to confirm you work in their area — and you make that clear.'
      : 'We didn\'t find any mention of your service area or city on the page. When someone searches for "roofer near me" and clicks your ad, they need to see their city or neighborhood on your site. Otherwise they assume you don\'t serve their area.',
    impact: 'high',
  });

  // 3. Ad click load time (high impact) — only if PageSpeed data available
  if (speed) {
    const loadSec = (speed.lcpMs / 1000).toFixed(1);
    findings.push({
      label: 'Ad click load time',
      pass: speed.lcpMs < 4000,
      detail: speed.lcpMs < 4000
        ? `Your site loads in ${loadSec}s after an ad click. That's fast enough to keep most paid visitors on the page.`
        : `Your site takes ${loadSec}s to load after an ad click. You're paying for every click — and at ${loadSec}s, a big chunk of those paid visitors leave before the page even finishes loading. Every second of delay cuts your conversion rate.`,
      impact: 'high',
    });
  }

  // 4. Focus / distraction score (medium impact)
  const tooManyNavLinks = page.navLinkCount > 8;
  const tooFewCtas = page.ctaCount < 2;
  const isDistracted = tooManyNavLinks && tooFewCtas;
  findings.push({
    label: 'Page focus and clarity',
    pass: !isDistracted,
    detail: !isDistracted
      ? 'Your page stays focused. It doesn\'t overwhelm visitors with too many navigation options, and it has clear calls-to-action. That\'s what you want for paid traffic.'
      : `Your page has ${page.navLinkCount} navigation links but only ${page.ctaCount === 0 ? 'zero' : page.ctaCount} call-to-action${page.ctaCount === 1 ? '' : 's'}. When you're paying for clicks, you want visitors focused on contacting you — not browsing around. Simplify the navigation and add more "Get a Quote" or "Call Now" buttons.`,
    impact: 'medium',
  });

  return {
    name: 'Ad Readiness',
    score: calculateCategoryScore(findings),
    findings,
  };
}
