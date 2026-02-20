/**
 * Lead Capture Analyzer (weight: 25% of overall score).
 *
 * Evaluates whether the site makes it easy for potential customers to
 * reach out — phone number, click-to-call, contact form, and clear
 * calls to action.
 */

import type { ParsedPage } from './fetch-page.js';
import { type CategoryResult, type Finding, calculateCategoryScore } from './types.js';

export function analyzeLeadCapture(page: ParsedPage): CategoryResult {
  const findings: Finding[] = [];

  // 1. Phone number visible (high impact)
  const phoneCount = page.phoneNumbers.length;
  findings.push({
    label: 'Phone number visible',
    pass: phoneCount > 0,
    detail: phoneCount > 0
      ? `We found ${phoneCount === 1 ? 'a phone number' : `${phoneCount} phone numbers`} on your site. Customers can see how to call you right away.`
      : 'We didn\'t find a phone number on your homepage. Most home service customers want to call — make that number big and obvious.',
    impact: 'high',
  });

  // 2. Click-to-call enabled (high impact)
  findings.push({
    label: 'Click-to-call phone link',
    pass: page.hasClickToCall,
    detail: page.hasClickToCall
      ? 'Your phone number is set up as a tap-to-call link. When someone taps it on their phone, it dials automatically. That\'s exactly what you want.'
      : 'Your phone number isn\'t set up as a tap-to-call link. On a phone, customers have to memorize the number and switch to their dialer. Adding a tap-to-call link is a quick win.',
    impact: 'high',
  });

  // 3. Contact form present (high impact)
  findings.push({
    label: 'Contact form present',
    pass: page.formCount > 0,
    detail: page.formCount > 0
      ? `Your site has ${page.formCount === 1 ? 'a contact form' : `${page.formCount} forms`}. Customers who don't want to call can still reach you.`
      : 'There\'s no contact form on your homepage. Some customers prefer filling out a form over calling — especially after hours. You\'re missing those leads.',
    impact: 'high',
  });

  // 4. CTA above the fold (medium impact)
  findings.push({
    label: 'Call-to-action above the fold',
    pass: page.hasCtaAboveFold,
    detail: page.hasCtaAboveFold
      ? 'You have a clear call-to-action visible as soon as the page loads. Visitors know what to do next without scrolling.'
      : 'There\'s no clear call-to-action visible when the page first loads. Visitors see your site but aren\'t told what to do next. Add a "Get a Free Quote" or "Call Now" button near the top.',
    impact: 'medium',
  });

  // 5. Multiple conversion points (medium impact)
  findings.push({
    label: 'Multiple conversion points',
    pass: page.ctaCount >= 2,
    detail: page.ctaCount >= 2
      ? `Your site has ${page.ctaCount} calls-to-action spread across the page. That gives customers multiple chances to reach out as they scroll.`
      : `Your site only has ${page.ctaCount === 0 ? 'zero' : 'one'} call-to-action. Add more throughout the page so customers can contact you wherever they are on the page.`,
    impact: 'medium',
  });

  return {
    name: 'Lead Capture',
    score: calculateCategoryScore(findings),
    findings,
  };
}
