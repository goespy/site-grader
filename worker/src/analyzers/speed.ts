/**
 * Page Speed Analyzer (weight: 15% of overall score).
 *
 * Evaluates how fast the site loads — overall performance, page weight,
 * first paint, layout stability, and interactivity.
 */

import type { PageSpeedResult } from './pagespeed.js';
import { type CategoryResult, type Finding, calculateCategoryScore } from './types.js';

/** Format bytes into a human-readable string (KB or MB). */
function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)}MB`;
  }
  return `${Math.round(bytes / 1_000)}KB`;
}

export function analyzeSpeed(speed: PageSpeedResult | null): CategoryResult {
  const findings: Finding[] = [];

  if (!speed) {
    findings.push({
      label: 'Speed data unavailable',
      pass: false,
      detail: 'We couldn\'t run a detailed speed test on your site right now. This usually means Google\'s testing service is temporarily unavailable. Try scanning again in a few minutes.',
      impact: 'high',
    });
    return { name: 'Page Speed', score: 0, findings };
  }

  // 1. Overall performance score (high impact)
  const perfPercent = Math.round(speed.performanceScore * 100);
  findings.push({
    label: 'Overall performance score',
    pass: speed.performanceScore >= 0.5,
    detail: speed.performanceScore >= 0.5
      ? `Your site scored ${perfPercent} out of 100 on Google's speed test. That's ${speed.performanceScore >= 0.9 ? 'excellent' : 'acceptable'} — ${speed.performanceScore >= 0.9 ? 'Google rewards fast sites with better search rankings.' : 'but there\'s room to improve. Faster sites rank higher and convert better.'}`
      : `Your site scored ${perfPercent} out of 100 on Google's speed test. That's below average. Google uses speed as a ranking factor, so this is hurting you in search results and driving away customers.`,
    impact: 'high',
  });

  // 2. Page weight (high impact)
  const totalMB = speed.totalBytes / 1_000_000;
  const sizeStr = formatBytes(speed.totalBytes);
  findings.push({
    label: 'Page weight',
    pass: totalMB < 3,
    detail: totalMB < 3
      ? `Your page is ${sizeStr} total. That's a reasonable size — it won't eat up your customers' phone data or take forever on a slow connection.`
      : `Your page is ${sizeStr} total. That's heavy — anything over 3MB loads slowly on phone connections. Large images are usually the culprit. Compress your images and your site will load much faster.`,
    impact: 'high',
  });

  // 3. First paint time (medium impact)
  const fcpSec = (speed.fcpMs / 1000).toFixed(1);
  findings.push({
    label: 'First paint time',
    pass: speed.fcpMs < 2000,
    detail: speed.fcpMs < 2000
      ? `Your site shows something on screen in ${fcpSec}s. That's fast enough that visitors know the page is loading and stick around.`
      : `Your site takes ${fcpSec}s before anything appears on screen. If a visitor sees a blank white page for more than 2 seconds, many assume it's broken and hit the back button.`,
    impact: 'medium',
  });

  // 4. Layout stability (medium impact)
  const clsFormatted = speed.clsScore.toFixed(2);
  findings.push({
    label: 'Layout stability',
    pass: speed.clsScore < 0.1,
    detail: speed.clsScore < 0.1
      ? `Your page layout stays stable while loading (shift score: ${clsFormatted}). Nothing jumps around unexpectedly when customers are trying to read or tap a button.`
      : `Your page layout shifts around while loading (shift score: ${clsFormatted}). You know that annoying thing where you try to tap a button and the page jumps? That's happening on your site. It frustrates customers and Google penalizes it.`,
    impact: 'medium',
  });

  // 5. Interactivity speed (low impact)
  const fidMs = Math.round(speed.fidMs);
  findings.push({
    label: 'Interactivity speed',
    pass: speed.fidMs < 300,
    detail: speed.fidMs < 300
      ? `Your site responds to taps and clicks in ${fidMs}ms. That feels snappy — customers won't notice any delay.`
      : `Your site takes ${fidMs}ms to respond after someone taps a button. Anything over 300ms feels sluggish. Usually this means the site is running too much code in the background.`,
    impact: 'low',
  });

  return {
    name: 'Page Speed',
    score: calculateCategoryScore(findings),
    findings,
  };
}
