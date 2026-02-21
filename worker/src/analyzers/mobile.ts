/**
 * Mobile Experience Analyzer (weight: 25% of overall score).
 *
 * Evaluates how well the site works on phones — load time, responsive
 * layout, readable text, and tap-friendly buttons.
 */

import type { ParsedPage } from './fetch-page.js';
import type { PageSpeedResult } from './pagespeed.js';
import { type CategoryResult, type Finding, calculateCategoryScore } from './types.js';

export function analyzeMobile(page: ParsedPage, speed: PageSpeedResult | null): CategoryResult {
  const findings: Finding[] = [];

  // Cross-check: if PageSpeed couldn't fully render (slow page), trust HTML signals
  const viewportPass = speed?.viewportSet || page.hasViewportMeta;
  const responsivePass = speed?.isResponsive || (page.hasViewportMeta && page.hasResponsiveCSS);
  const fontSizePass = speed?.fontSizeOk || (page.hasResponsiveCSS && !speed);
  const tapTargetsPass = speed?.tapTargetsOk || (page.hasResponsiveCSS && !speed);

  if (speed) {
    // 1. Mobile load time (high impact)
    const loadSec = (speed.lcpMs / 1000).toFixed(1);
    findings.push({
      label: 'Mobile load time',
      pass: speed.lcpMs < 3000,
      detail: speed.lcpMs < 3000
        ? `Your site loads in ${loadSec}s on a standard mobile connection. That's solid — most visitors stick around when it loads under 3 seconds.`
        : `Your site takes ${loadSec}s to fully load on a standard mobile connection — that's what your customers on spotty cell service or older phones experience. The industry threshold is under 3s. It may feel fast on your WiFi, but over half your ad traffic won't wait that long.`,
      impact: 'high',
    });
  }

  // 2. Mobile-responsive layout (high impact)
  findings.push({
    label: 'Mobile-responsive layout',
    pass: responsivePass,
    detail: responsivePass
      ? 'Your site adjusts properly to phone screens. Text and images resize to fit without sideways scrolling.'
      : 'Your site doesn\'t adapt to phone screens. Visitors have to pinch and zoom, which drives most of them away.',
    impact: 'high',
  });

  // 3. Viewport configured (medium impact)
  findings.push({
    label: 'Viewport configured',
    pass: viewportPass,
    detail: viewportPass
      ? 'Your site tells the phone browser how to size the page correctly. This is a basic but important mobile requirement.'
      : 'Your site is missing the viewport setting that tells phones how to display the page. Without it, the page shows up tiny on mobile screens.',
    impact: 'medium',
  });

  // 4. Text size on mobile (medium impact)
  findings.push({
    label: 'Readable text on mobile',
    pass: fontSizePass,
    detail: fontSizePass
      ? 'Text on your site is large enough to read on a phone without zooming in. Customers can easily read your content.'
      : 'Some text on your site is too small to read on a phone. Customers have to zoom in, which is frustrating and makes them more likely to leave.',
    impact: 'medium',
  });

  // 5. Tap-friendly buttons (medium impact)
  findings.push({
    label: 'Tap-friendly buttons',
    pass: tapTargetsPass,
    detail: tapTargetsPass
      ? 'Your buttons and links are large enough to tap easily on a phone. No accidental mis-taps for your customers.'
      : 'Some buttons or links on your site are too small or too close together on a phone. Customers will tap the wrong thing, get frustrated, and leave.',
    impact: 'medium',
  });

  return {
    name: 'Mobile Experience',
    score: calculateCategoryScore(findings),
    findings,
  };
}
